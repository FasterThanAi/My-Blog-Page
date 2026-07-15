"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendNotificationEmail } from "@/lib/email";

// Keyset cursor validation schema
const cursorSchema = z.object({
  publishedAt: z.string(),
  id: z.string().uuid(),
}).nullable().optional();

const latestPostsSchema = z.object({
  cursor: cursorSchema,
  tag: z.string().nullable().optional(),
});

const trendingPostsSchema = z.object({
  tag: z.string().nullable().optional(),
});

const toggleFollowSchema = z.object({
  followingId: z.string().uuid(),
});

const toggleReactionSchema = z.object({
  postId: z.string().uuid(),
  type: z.string().min(1).max(20),
});

const toggleBookmarkSchema = z.object({
  postId: z.string().uuid(),
});

/**
 * Keyset-paginated Latest posts feed.
 */
export async function getPublicLatestPostsAction(input: unknown) {
  const validation = latestPostsSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { cursor, tag } = validation.data;
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select("*, profiles!author_id(*), reactions(count)")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(6);

  if (cursor) {
    // Keyset pagination compound constraint: (published_at < cursor.publishedAt) OR (published_at = cursor.publishedAt AND id < cursor.id)
    query = query.or(`published_at.lt.${cursor.publishedAt},and(published_at.eq.${cursor.publishedAt},id.lt.${cursor.id})`);
  }

  if (tag) {
    const { data: tagData } = await supabase
      .from("tags")
      .select("id")
      .eq("name", tag)
      .maybeSingle();

    if (!tagData) return [];

    const { data: linkedPostIds } = await supabase
      .from("post_tags")
      .select("post_id")
      .eq("tag_id", tagData.id);

    const postIds = linkedPostIds?.map((lp) => lp.post_id) || [];
    if (postIds.length === 0) return [];

    query = query.in("id", postIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data || [];
}

/**
 * Trending posts feed calculated over the last 14 days.
 * Ranking formula: score = views + (likes * 3)
 * Decay formula: rank = score / (age_in_hours + 2)^1.5
 */
export async function getPublicTrendingPostsAction(input: unknown) {
  const validation = trendingPostsSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { tag } = validation.data;
  const supabase = await createClient();

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("posts")
    .select("*, profiles!author_id(*), reactions(count)")
    .eq("status", "published")
    .eq("visibility", "public")
    .gte("published_at", fourteenDaysAgo);

  if (tag) {
    const { data: tagData } = await supabase
      .from("tags")
      .select("id")
      .eq("name", tag)
      .maybeSingle();

    if (!tagData) return [];

    const { data: linkedPostIds } = await supabase
      .from("post_tags")
      .select("post_id")
      .eq("tag_id", tagData.id);

    const postIds = linkedPostIds?.map((lp) => lp.post_id) || [];
    if (postIds.length === 0) return [];

    query = query.in("id", postIds);
  }

  const { data: posts, error } = await query;
  if (error) throw new Error(error.message);

  if (!posts || posts.length === 0) return [];

  // Compute trending ranking with time-based decay in JavaScript
  const ranked = posts.map((post) => {
    const views = post.view_count || 0;
    const likes = post.reactions?.[0]?.count || 0;
    const score = views + likes * 3;

    const publishedTime = new Date(post.published_at).getTime();
    const ageInHours = (Date.now() - publishedTime) / (1000 * 60 * 60);

    // Gravity standard age decay (Linear/HackerNews style)
    const ranking = score / Math.pow(ageInHours + 2, 1.5);

    return { ...post, ranking };
  });

  // Sort descending by rank
  return ranked.sort((a, b) => b.ranking - a.ranking).slice(0, 10);
}

/**
 * Keyset-paginated Following posts feed.
 */
export async function getPublicFollowingPostsAction(input: unknown) {
  const validation = latestPostsSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { cursor, tag } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return []; // Return empty if not authenticated
  }

  // Fetch authors followed by this user
  const { data: follows, error: followsError } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);

  if (followsError) throw new Error(followsError.message);
  if (!follows || follows.length === 0) return [];

  const followingIds = follows.map((f) => f.following_id);

  let query = supabase
    .from("posts")
    .select("*, profiles!author_id(*), reactions(count)")
    .eq("status", "published")
    .eq("visibility", "public")
    .in("author_id", followingIds)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(6);

  if (cursor) {
    query = query.or(`published_at.lt.${cursor.publishedAt},and(published_at.eq.${cursor.publishedAt},id.lt.${cursor.id})`);
  }

  if (tag) {
    const { data: tagData } = await supabase
      .from("tags")
      .select("id")
      .eq("name", tag)
      .maybeSingle();

    if (!tagData) return [];

    const { data: linkedPostIds } = await supabase
      .from("post_tags")
      .select("post_id")
      .eq("tag_id", tagData.id);

    const postIds = linkedPostIds?.map((lp) => lp.post_id) || [];
    if (postIds.length === 0) return [];

    query = query.in("id", postIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data || [];
}

/**
 * Toggles a user following connection.
 */
export async function toggleFollowAction(input: unknown) {
  const validation = toggleFollowSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { followingId } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Please sign in to follow authors.");
  }

  if (user.id === followingId) {
    throw new Error("You cannot follow yourself.");
  }

  // Check current status
  const { data: existingFollow } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .maybeSingle();

  if (existingFollow) {
    // Unfollow
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", followingId);

    if (error) throw new Error(error.message);
    return { followed: false };
  } else {
    // Follow
    const { error } = await supabase
      .from("follows")
      .insert({
        follower_id: user.id,
        following_id: followingId,
      });

    if (error) throw new Error(error.message);

    // Log follow notification
    try {
      await supabase.from("notifications").insert({
        user_id: followingId,
        actor_id: user.id,
        type: "follow",
      });

      // Trigger email notification (asynchronously)
      try {
        const { data: actorProfile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", user.id)
          .single();

        const actorName = actorProfile?.display_name || actorProfile?.username || "Someone";

        sendNotificationEmail({
          recipientId: followingId,
          actorName,
          eventType: "follow",
        }).catch(console.error);
      } catch (emailErr) {
        console.error("Follow email send trigger error:", emailErr);
      }
    } catch {
      // Fail silently
    }

    return { followed: true };
  }
}

/**
 * Toggles post likes / reactions.
 */
export async function toggleReactionAction(input: unknown) {
  const validation = toggleReactionSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { postId, type } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Please sign in to react to posts.");
  }

  // Check current reaction status
  const { data: existingReaction } = await supabase
    .from("reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .eq("type", type)
    .maybeSingle();

  if (existingReaction) {
    // Remove reaction
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .eq("type", type);

    if (error) throw new Error(error.message);
    return { reacted: false };
  } else {
    // Add reaction
    const { error } = await supabase
      .from("reactions")
      .insert({
        post_id: postId,
        user_id: user.id,
        type,
      });

    if (error) throw new Error(error.message);

    // Log reaction notification
    try {
      const { data: post } = await supabase
        .from("posts")
        .select("author_id")
        .eq("id", postId)
        .maybeSingle();

      if (post && post.author_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.author_id,
          actor_id: user.id,
          type: "reaction",
          post_id: postId,
        });
      }
    } catch {
      // Fail silently
    }

    return { reacted: true };
  }
}

/**
 * Toggles post bookmarks.
 */
export async function toggleBookmarkAction(input: unknown) {
  const validation = toggleBookmarkSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { postId } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Please sign in to bookmark posts.");
  }

  // Check status
  const { data: existingBookmark } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  if (existingBookmark) {
    // Unbookmark
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("post_id", postId);

    if (error) throw new Error(error.message);
    return { bookmarked: false };
  } else {
    // Bookmark
    const { error } = await supabase
      .from("bookmarks")
      .insert({
        user_id: user.id,
        post_id: postId,
      });

    if (error) throw new Error(error.message);
    return { bookmarked: true };
  }
}

/**
 * Increments post view count once per 24 hours per user session.
 */
export async function incrementPostViewAction(input: unknown) {
  const schema = z.object({ postId: z.string().uuid() });
  const validation = schema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { postId } = validation.data;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const cookieName = `viewed_post_${postId}`;

  if (cookieStore.has(cookieName)) {
    return { incremented: false };
  }

  // Set viewed cookie for 24 hours
  cookieStore.set(cookieName, "true", {
    maxAge: 60 * 60 * 24,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  // Fetch and update view count
  const { data: post } = await supabase
    .from("posts")
    .select("view_count")
    .eq("id", postId)
    .maybeSingle();

  if (post) {
    const { error } = await supabase
      .from("posts")
      .update({ view_count: (post.view_count || 0) + 1 })
      .eq("id", postId);

    if (error) throw new Error(error.message);
  }

  return { incremented: true };
}
