"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const saveDrawingSchema = z.object({
  id: z.string().uuid("Invalid Drawing ID"),
  post_id: z.string().uuid("Invalid Post ID"),
  // scene is arbitrary JSON structure from Excalidraw canvas exports. Zod allows z.any() here as the canvas structure is open-ended.
  scene: z.any(),
  preview_url: z.string().url("Invalid Preview URL"),
});

const getDrawingSchema = z.object({
  id: z.string().uuid("Invalid Drawing ID"),
});

/**
 * Saves or updates a drawing scene and its preview SVG URL.
 */
export async function saveDrawingAction(input: unknown) {
  const validation = saveDrawingSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { id, post_id, scene, preview_url } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized.");
  }

  // Check if drawing already exists to verify authorship
  const { data: existingDrawing } = await supabase
    .from("drawings")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();

  if (existingDrawing && existingDrawing.author_id !== user.id) {
    // Get user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner") {
      throw new Error("You do not have permission to edit this drawing.");
    }
  }

  // Insert or Update the drawing record
  const { error: upsertError } = await supabase
    .from("drawings")
    .upsert({
      id,
      post_id,
      author_id: user.id,
      scene,
      preview_url,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return { success: true };
}

/**
 * Retrieves a drawing record by its ID, respecting visibility constraints.
 */
export async function getDrawingAction(input: unknown) {
  const validation = getDrawingSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { id } = validation.data;
  const supabase = await createClient();

  const { data: drawing, error } = await supabase
    .from("drawings")
    .select("id, post_id, author_id, scene, preview_url")
    .eq("id", id)
    .single();

  if (error || !drawing) {
    throw new Error("Drawing not found or access denied.");
  }

  return drawing;
}
