"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendNotificationEmail } from "@/lib/email";

const createCommentSchema = z.object({
  postId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  body: z.string().min(1).max(10000),
});

const editCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: z.string().min(1).max(10000),
});

const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});

const voteCommentSchema = z.object({
  commentId: z.string().uuid(),
  value: z.union([z.literal(1), z.literal(-1)]),
});

/**
 * Inserts a new comment into the database and triggers notifications.
 */
export async function createCommentAction(input: unknown) {
  const validation = createCommentSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { postId, parentId, body } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to comment.");
  }

  // Insert the comment record
  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      parent_id: parentId || null,
      author_id: user.id,
      body,
    })
    .select()
    .single();

  if (commentError || !comment) {
    throw new Error(commentError?.message || "Failed to create comment.");
  }

  // Trigger notification logs (asynchronously)
  try {
    if (parentId) {
      // Fetch parent comment author
      const { data: parentComment } = await supabase
        .from("comments")
        .select("author_id")
        .eq("id", parentId)
        .maybeSingle();

      if (parentComment && parentComment.author_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: parentComment.author_id,
          actor_id: user.id,
          type: "reply",
          post_id: postId,
          comment_id: comment.id,
        });

        // Trigger email notification (asynchronously)
        try {
          const { data: actorProfile } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", user.id)
            .single();

          const { data: post } = await supabase
            .from("posts")
            .select("title")
            .eq("id", postId)
            .maybeSingle();

          const actorName = actorProfile?.display_name || actorProfile?.username || "Someone";
          const postTitle = post?.title || "your post";

          sendNotificationEmail({
            recipientId: parentComment.author_id,
            actorName,
            eventType: "reply",
            postTitle,
            commentBody: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
          }).catch(console.error);
        } catch (emailErr) {
          console.error("Email send trigger error:", emailErr);
        }
      }
    } else {
      // Fetch post author
      const { data: post } = await supabase
        .from("posts")
        .select("author_id")
        .eq("id", postId)
        .maybeSingle();

      if (post && post.author_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.author_id,
          actor_id: user.id,
          type: "comment",
          post_id: postId,
          comment_id: comment.id,
        });
      }
    }
  } catch (err) {
    console.error("Notification creation error:", err);
    // Fail silently on notifications logging so core comment transaction succeeds
  }

  return comment;
}

/**
 * Edits an existing comment.
 */
export async function editCommentAction(input: unknown) {
  const validation = editCommentSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { commentId, body } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to edit comments.");
  }

  const { data: comment } = await supabase
    .from("comments")
    .select("author_id, is_deleted")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) throw new Error("Comment not found.");
  if (comment.is_deleted) throw new Error("Cannot edit a deleted comment.");
  if (comment.author_id !== user.id) throw new Error("Unauthorized.");

  const { error } = await supabase
    .from("comments")
    .update({
      body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId);

  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Soft deletes a comment.
 */
export async function deleteCommentAction(input: unknown) {
  const validation = deleteCommentSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { commentId } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to delete comments.");
  }

  const { data: comment } = await supabase
    .from("comments")
    .select("author_id, is_deleted")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) throw new Error("Comment not found.");
  if (comment.is_deleted) return { success: true };
  if (comment.author_id !== user.id) throw new Error("Unauthorized.");

  const { error } = await supabase
    .from("comments")
    .update({
      is_deleted: true,
      body: "[deleted]",
    })
    .eq("id", commentId);

  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Casts a vote on a comment with rate limits validation.
 */
export async function voteCommentAction(input: unknown) {
  const validation = voteCommentSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { commentId, value } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to vote.");
  }

  // 1. Rate-limit validation: max 30 updates per 60 seconds
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("comment_votes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneMinuteAgo);

  if (countError) throw new Error(countError.message);
  if (count !== null && count >= 30) {
    throw new Error("Rate limit exceeded. Maximum 30 votes per minute.");
  }

  // 2. Fetch existing vote state
  const { data: existing } = await supabase
    .from("comment_votes")
    .select("value")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.value === value) {
      // Toggle off: remove the vote record
      const { error } = await supabase
        .from("comment_votes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);

      if (error) throw new Error(error.message);
      return { value: 0 };
    } else {
      // Flip vote: update the vote record
      const { error } = await supabase
        .from("comment_votes")
        .update({ value, created_at: new Date().toISOString() })
        .eq("comment_id", commentId)
        .eq("user_id", user.id);

      if (error) throw new Error(error.message);
      return { value };
    }
  } else {
    // Insert new vote record
    const { error } = await supabase.from("comment_votes").insert({
      comment_id: commentId,
      user_id: user.id,
      value,
    });

    if (error) throw new Error(error.message);
    return { value };
  }
}
