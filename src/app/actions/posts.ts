"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Helper to normalize and generate URL-safe slugs
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
}

// Recursively extract plain text from Tiptap JSON node
function extractText(node: TiptapNode): string {
  if (!node) return "";
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }
  if (Array.isArray(node.content)) {
    return node.content.map((child) => extractText(child)).join(" ");
  }
  return "";
}

// Zod schemas for input validation
const savePostSchema = z.object({
  id: z.string().uuid("Invalid Post ID"),
  title: z.string().max(200, "Title is too long"),
  // content is arbitrary JSON structure from Tiptap editor. Zod allows z.any() here as the Tiptap structure is open-ended.
  content: z.any(),
});

const deletePostSchema = z.object({
  id: z.string().uuid("Invalid Post ID"),
});

const publishPostSchema = z.object({
  id: z.string().uuid("Invalid Post ID"),
  cover_image_url: z.string().url().nullable().optional().or(z.literal("")),
  excerpt: z.string().max(400, "Excerpt must be under 400 characters").nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(5, "Maximum of 5 tags allowed"),
  visibility: z.enum(["public", "private", "unlisted"]),
  status: z.enum(["draft", "published", "archived"]),
  seo_title: z.string().max(100, "SEO title must be under 100 characters").nullable().optional(),
  seo_description: z.string().max(200, "SEO description must be under 200 characters").nullable().optional(),
});

/**
 * Creates a new draft post under the current authenticated user.
 */
export async function createDraftAction() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized. Please sign in to create a post.");
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      title: "Untitled",
      content: {},
      status: "draft",
      visibility: "public",
    })
    .select("id")
    .single();

  if (error || !post) {
    throw new Error(error?.message || "Failed to create draft post.");
  }

  return post.id;
}

/**
 * Saves a post's title and content. Triggered on debounced autosave.
 */
export async function savePostAction(input: unknown) {
  const validation = savePostSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { id, title, content } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized.");
  }

  // Ensure author is writing to their own post
  const { data: existingPost, error: checkError } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", id)
    .single();

  if (checkError || !existingPost) {
    throw new Error("Post not found.");
  }

  if (existingPost.author_id !== user.id) {
    throw new Error("You do not have permission to edit this post.");
  }

  // Perform save update
  const { error: updateError } = await supabase
    .from("posts")
    .update({
      title,
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { success: true };
}

/**
 * Deletes a post. Restricted to post author or admin owners.
 */
export async function deletePostAction(input: unknown) {
  const validation = deletePostSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { id } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized.");
  }

  // Fetch roles / author status
  const { data: post, error: fetchError } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", id)
    .single();

  if (fetchError || !post) {
    throw new Error("Post not found.");
  }

  // Get user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAuthor = post.author_id === user.id;
  const isOwner = profile?.role === "owner";

  if (!isAuthor && !isOwner) {
    throw new Error("You do not have permission to delete this post.");
  }

  const { error: deleteError } = await supabase
    .from("posts")
    .delete()
    .eq("id", id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return { success: true };
}

/**
 * Publishes/Updates post details: cover image, tags, visibility, status.
 * Dynamically updates unique slugs and computes reading time.
 */
export async function publishPostAction(input: unknown) {
  const validation = publishPostSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { id, cover_image_url, excerpt, tags, visibility, status, seo_title, seo_description } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized.");
  }

  // Fetch the current post to check permissions and reading time
  const { data: post, error: fetchError } = await supabase
    .from("posts")
    .select("author_id, title, content, slug, published_at")
    .eq("id", id)
    .single();

  if (fetchError || !post) {
    throw new Error("Post not found.");
  }

  if (post.author_id !== user.id) {
    throw new Error("You do not have permission to publish this post.");
  }

  // 1. Generate unique URL slug (only if not already set or status shifts to published)
  let slug = post.slug;
  if (!slug || status === "published") {
    let baseSlug = slugify(post.title || "untitled");
    if (!baseSlug) baseSlug = "untitled";
    slug = baseSlug;
    let suffix = 1;
    while (true) {
      const { data: duplicate } = await supabase
        .from("posts")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .maybeSingle();

      if (!duplicate) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }
  }

  // 2. Compute reading time (words / 230, min 1)
  const plainText = extractText(post.content as TiptapNode);
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  const reading_time_minutes = Math.max(1, Math.ceil(words / 230));

  // 3. Determine published_at timestamp
  let published_at = post.published_at;
  if (status === "published" && !published_at) {
    published_at = new Date().toISOString();
  } else if (status !== "published") {
    published_at = null;
  }

  // 4. Update the post details
  const { error: updateError } = await supabase
    .from("posts")
    .update({
      cover_image_url: cover_image_url || null,
      excerpt: excerpt || null,
      visibility,
      status,
      slug,
      reading_time_minutes,
      published_at,
      seo_title: seo_title || null,
      seo_description: seo_description || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // 5. Update post tags link mapping
  // A. Clear current mappings
  await supabase.from("post_tags").delete().eq("post_id", id);

  // B. Parse, create tags, and link
  if (tags && tags.length > 0) {
    for (const tagName of tags) {
      const trimmedName = tagName.trim();
      if (!trimmedName) continue;

      const tagSlug = slugify(trimmedName);

      // Check if tag exists
      const { data: existingTag } = await supabase
        .from("tags")
        .select("id")
        .eq("name", trimmedName)
        .maybeSingle();

      let tagId;
      if (existingTag) {
        tagId = existingTag.id;
      } else {
        // Create tag
        const { data: newTag, error: tagCreateError } = await supabase
          .from("tags")
          .insert({ name: trimmedName, slug: tagSlug })
          .select("id")
          .single();

        if (tagCreateError) throw tagCreateError;
        tagId = newTag.id;
      }

      // Link post and tag
      await supabase.from("post_tags").insert({
        post_id: id,
        tag_id: tagId,
      });
    }
  }

  return { success: true, slug };
}
