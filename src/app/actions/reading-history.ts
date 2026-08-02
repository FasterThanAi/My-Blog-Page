"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { computeReadingStreak } from "@/lib/reading-streak";

const saveProgressSchema = z.object({
  postId: z.string().uuid(),
  scrollPercent: z.number().int().min(0).max(100),
});

const postIdSchema = z.object({
  postId: z.string().uuid(),
});

/**
 * Upserts the authenticated user's scroll progress for a post.
 * Marks `completed_at` the first time progress crosses 80%.
 * No-ops silently for signed-out visitors (nothing to persist against).
 */
export async function saveReadingProgressAction(input: unknown) {
  const validation = saveProgressSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { postId, scrollPercent } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { saved: false };
  }

  const { data: existing } = await supabase
    .from("reading_history")
    .select("scroll_percent, completed_at")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  // Never let a later, shorter session erase further progress already recorded.
  if (existing && existing.scroll_percent > scrollPercent) {
    return { saved: false };
  }

  const shouldMarkCompleted = scrollPercent >= 80;
  const completedAt = existing?.completed_at || (shouldMarkCompleted ? new Date().toISOString() : null);

  const { error } = await supabase
    .from("reading_history")
    .upsert(
      {
        user_id: user.id,
        post_id: postId,
        scroll_percent: scrollPercent,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,post_id" }
    );

  if (error) throw new Error(error.message);

  return { saved: true };
}

/**
 * Fetches the authenticated user's saved progress for a single post.
 * Returns null scrollPercent for signed-out visitors or first-time reads.
 */
export async function getReadingProgressAction(input: unknown) {
  const validation = postIdSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { postId } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { scrollPercent: 0 };
  }

  const { data } = await supabase
    .from("reading_history")
    .select("scroll_percent")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  return { scrollPercent: data?.scroll_percent || 0 };
}

/**
 * Computes the authenticated user's current daily reading streak from
 * completed reads (posts scrolled past 80%). A streak counts consecutive
 * calendar days (UTC) with at least one completed read, ending today or
 * yesterday (so it doesn't reset the instant midnight passes).
 */
export async function getReadingStreakAction() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { currentStreak: 0, totalCompleted: 0 };
  }

  const { data, error } = await supabase
    .from("reading_history")
    .select("completed_at")
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    return { currentStreak: 0, totalCompleted: 0 };
  }

  const currentStreak = computeReadingStreak(data.map((row) => row.completed_at as string));

  return { currentStreak, totalCompleted: data.length };
}
