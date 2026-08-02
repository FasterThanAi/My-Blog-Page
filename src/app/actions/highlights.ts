"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const saveHighlightSchema = z.object({
  postId: z.string().uuid(),
  text: z.string().min(1, "Highlighted text is required").max(500, "Highlight is too long to save (max 500 characters)"),
});

const deleteHighlightSchema = z.object({
  highlightId: z.string().uuid(),
});

/**
 * Saves a reader's selected excerpt from a post as a highlight.
 */
export async function saveHighlightAction(input: unknown) {
  const validation = saveHighlightSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { postId, text } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Please sign in to save highlights.");
  }

  const { data, error } = await supabase
    .from("highlights")
    .insert({ user_id: user.id, post_id: postId, text })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  return { highlightId: data.id as string };
}

/**
 * Deletes a highlight owned by the authenticated user.
 */
export async function deleteHighlightAction(input: unknown) {
  const validation = deleteHighlightSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { highlightId } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Please sign in to manage highlights.");
  }

  const { error } = await supabase
    .from("highlights")
    .delete()
    .eq("id", highlightId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  return { deleted: true };
}

/**
 * Lists the authenticated user's saved highlights for a given post.
 */
export async function getMyHighlightsForPostAction(input: unknown) {
  const schema = z.object({ postId: z.string().uuid() });
  const validation = schema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("highlights")
    .select("id, text, created_at")
    .eq("user_id", user.id)
    .eq("post_id", validation.data.postId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data || [];
}
