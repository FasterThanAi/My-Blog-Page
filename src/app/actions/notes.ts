"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createNoteSchema = z.object({
  body: z.string().min(1, "Write something first").max(500, "Notes are limited to 500 characters"),
});

const cursorSchema = z.object({ createdAt: z.string(), id: z.string().uuid() }).nullable().optional();
const feedSchema = z.object({ cursor: cursorSchema });

const noteIdSchema = z.object({ noteId: z.string().uuid() });

/**
 * Creates a short-form note. Public feed item, visible to everyone.
 */
export async function createNoteAction(input: unknown) {
  const validation = createNoteSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Please sign in to post a note.");

  const { data, error } = await supabase
    .from("notes")
    .insert({ author_id: user.id, body: validation.data.body })
    .select("*, profiles!author_id(username, display_name, avatar_url)")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Cross-author, keyset-paginated Notes discovery feed (newest first).
 */
export async function listNotesFeedAction(input: unknown) {
  const validation = feedSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { cursor } = validation.data;
  const supabase = await createClient();

  let query = supabase
    .from("notes")
    .select("*, profiles!author_id(username, display_name, avatar_url), note_likes(count)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);

  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Deletes a note owned by the authenticated user (or platform owner).
 */
export async function deleteNoteAction(input: unknown) {
  const validation = noteIdSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized.");

  const { error } = await supabase.from("notes").delete().eq("id", validation.data.noteId).eq("author_id", user.id);

  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Toggles a like on a note.
 */
export async function toggleNoteLikeAction(input: unknown) {
  const validation = noteIdSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { noteId } = validation.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Please sign in to like notes.");

  const { data: existing } = await supabase
    .from("note_likes")
    .select("note_id")
    .eq("note_id", noteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("note_likes").delete().eq("note_id", noteId).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return { liked: false };
  }

  const { error } = await supabase.from("note_likes").insert({ note_id: noteId, user_id: user.id });
  if (error) throw new Error(error.message);
  return { liked: true };
}
