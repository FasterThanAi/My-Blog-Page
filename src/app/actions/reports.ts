"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const submitReportSchema = z.object({
  postId: z.string().uuid().nullable().optional(),
  commentId: z.string().uuid().nullable().optional(),
  reason: z.string().min(1).max(100),
  detail: z.string().max(2000).optional(),
});

/**
 * Commits a content flag report.
 */
export async function submitReportAction(input: unknown) {
  const validation = submitReportSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(validation.error.issues[0].message);
  }

  const { postId, commentId, reason, detail } = validation.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to submit a report.");
  }

  if (!postId && !commentId) {
    throw new Error("Target content parameters are missing.");
  }

  const formattedReason = detail ? `${reason}: ${detail}` : reason;

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    post_id: postId || null,
    comment_id: commentId || null,
    reason: formattedReason,
    status: "open",
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}
