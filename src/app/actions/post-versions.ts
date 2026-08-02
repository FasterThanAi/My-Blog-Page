"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Throttled autosave snapshot: only inserts a new post_versions row if the
 * most recent snapshot for this post is older than MIN_SNAPSHOT_INTERVAL_MS
 * (or none exists yet). Called from savePostAction so revision history
 * accumulates meaningful checkpoints instead of one row per keystroke.
 * Swallows its own errors — snapshotting must never block an autosave.
 */
export async function snapshotPostVersionIfDue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  postId: string,
  authorId: string,
  title: string,
  content: unknown,
  label: string = "Autosave"
) {
  try {
    const { data: latest } = await supabase
      .from("post_versions")
      .select("created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest && Date.now() - new Date(latest.created_at).getTime() < MIN_SNAPSHOT_INTERVAL_MS) {
      return;
    }

    await supabase.from("post_versions").insert({
      post_id: postId,
      author_id: authorId,
      title,
      content,
      label,
    });
  } catch {
    // Non-critical — never block the actual save on a snapshot failure
  }
}

const listVersionsSchema = z.object({ postId: z.string().uuid() });

export async function listPostVersionsAction(input: unknown) {
  const validation = listVersionsSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized.");

  const { data, error } = await supabase
    .from("post_versions")
    .select("id, title, content, label, created_at")
    .eq("post_id", validation.data.postId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);

  return data || [];
}

const restoreVersionSchema = z.object({
  postId: z.string().uuid(),
  versionId: z.string().uuid(),
});

/**
 * Restores a post's title/content from a saved version. Snapshots the
 * current (pre-restore) state first, so a restore is itself undoable.
 */
export async function restorePostVersionAction(input: unknown) {
  const validation = restoreVersionSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { postId, versionId } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized.");

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("author_id, title, content")
    .eq("id", postId)
    .single();

  if (postError || !post) throw new Error("Post not found.");
  if (post.author_id !== user.id) {
    throw new Error("You do not have permission to edit this post.");
  }

  const { data: version, error: versionError } = await supabase
    .from("post_versions")
    .select("title, content")
    .eq("id", versionId)
    .eq("post_id", postId)
    .single();

  if (versionError || !version) throw new Error("Version not found.");

  // Snapshot the current state before overwriting, unconditionally (bypass throttle)
  await supabase.from("post_versions").insert({
    post_id: postId,
    author_id: user.id,
    title: post.title,
    content: post.content,
    label: "Before restore",
  });

  const { error: updateError } = await supabase
    .from("posts")
    .update({
      title: version.title,
      content: version.content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (updateError) throw new Error(updateError.message);

  return { title: version.title, content: version.content };
}
