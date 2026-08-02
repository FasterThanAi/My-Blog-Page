"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const addSchema = z.object({
  recommendedUsername: z.string().min(1, "Enter a username"),
  note: z.string().max(140).optional(),
});

const removeSchema = z.object({ recommendedId: z.string().uuid() });
const usernameSchema = z.object({ username: z.string().min(1) });

/**
 * Recommends another author (by username) to the authenticated user's own
 * readers. Shown on the recommender's public profile.
 */
export async function addRecommendationAction(input: unknown) {
  const validation = addSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in to recommend authors.");

  const { data: target } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio")
    .eq("username", validation.data.recommendedUsername.trim().toLowerCase())
    .maybeSingle();

  if (!target) throw new Error("No author found with that username.");
  if (target.id === user.id) throw new Error("You can't recommend yourself.");

  const { error } = await supabase.from("author_recommendations").insert({
    recommender_id: user.id,
    recommended_id: target.id,
    note: validation.data.note || null,
  });

  if (error) {
    if (error.code === "23505") throw new Error("You've already recommended this author.");
    throw new Error(error.message);
  }

  return target;
}

export async function removeRecommendationAction(input: unknown) {
  const validation = removeSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized.");

  const { error } = await supabase
    .from("author_recommendations")
    .delete()
    .eq("recommender_id", user.id)
    .eq("recommended_id", validation.data.recommendedId);

  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Lists the authors a given profile (by username) recommends, for display
 * on their public profile page.
 */
export async function listRecommendationsForUserAction(input: unknown) {
  const validation = usernameSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", validation.data.username)
    .maybeSingle();

  if (!profile) return [];

  const { data, error } = await supabase
    .from("author_recommendations")
    .select("note, created_at, profiles!recommended_id(id, username, display_name, avatar_url, bio)")
    .eq("recommender_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}
