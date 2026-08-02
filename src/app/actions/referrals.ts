"use server";

import { createClient } from "@/lib/supabase/server";

const BADGE_THRESHOLD = 3;

/**
 * Returns the authenticated user's referral stats: how many people signed
 * up using their referral link, and whether they've crossed the badge
 * threshold. No payment integration — this is a recognition badge, not a
 * monetary reward (Stripe-based rewards are tracked separately).
 */
export async function getMyReferralStatsAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { count: 0, hasBadge: false, threshold: BADGE_THRESHOLD };

  const { count } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", user.id);

  const total = count || 0;
  return { count: total, hasBadge: total >= BADGE_THRESHOLD, threshold: BADGE_THRESHOLD };
}
