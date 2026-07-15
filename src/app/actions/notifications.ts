"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const markReadSchema = z.object({
  id: z.string().uuid("Invalid notification ID"),
});

/**
  * Marks a single notification as read.
  */
export async function markNotificationAsReadAction(input: unknown) {
  const validation = markReadSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { id } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to perform this action.");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

/**
  * Marks all notifications of the user as read.
  */
export async function markAllNotificationsAsReadAction() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to perform this action.");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}
