"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Helper to verify that the active user is an owner
 */
export async function verifyOwnerAccess() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "owner") {
    throw new Error("Forbidden: Owner access required");
  }

  return user;
}

/**
 * 1. Overview Actions: Analytics and delta counts
 */
export async function fetchDashboardAnalytics() {
  await verifyOwnerAccess();
  const supabase = await createClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Queries for current totals
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: totalPosts } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("status", "published");

  const { count: totalComments } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("is_deleted", false);

  const { count: totalReactions } = await supabase
    .from("reactions")
    .select("*", { count: "exact", head: true });

  // Queries for 7-day deltas
  const { count: recentUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo.toISOString());

  const { count: recentPosts } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("status", "published")
    .gte("published_at", sevenDaysAgo.toISOString());

  const { count: recentComments } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("is_deleted", false)
    .gte("created_at", sevenDaysAgo.toISOString());

  const { count: recentReactions } = await supabase
    .from("reactions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo.toISOString());

  // Aggregate 30-day time series data for line chart
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: chartUsers } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", thirtyDaysAgo.toISOString());

  const { data: chartPosts } = await supabase
    .from("posts")
    .select("created_at")
    .gte("created_at", thirtyDaysAgo.toISOString());

  // Group signups and posts by date (YYYY-MM-DD)
  const timeSeries: Record<string, { signups: number; posts: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    timeSeries[dateStr] = { signups: 0, posts: 0 };
  }

  chartUsers?.forEach((u) => {
    const dateStr = new Date(u.created_at).toISOString().split("T")[0];
    if (timeSeries[dateStr]) {
      timeSeries[dateStr].signups++;
    }
  });

  chartPosts?.forEach((p) => {
    const dateStr = new Date(p.created_at).toISOString().split("T")[0];
    if (timeSeries[dateStr]) {
      timeSeries[dateStr].posts++;
    }
  });

  const chartData = Object.entries(timeSeries).map(([date, val]) => ({
    date,
    ...val,
  })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    stats: {
      users: { total: totalUsers || 0, delta: recentUsers || 0 },
      posts: { total: totalPosts || 0, delta: recentPosts || 0 },
      comments: { total: totalComments || 0, delta: recentComments || 0 },
      reactions: { total: totalReactions || 0, delta: recentReactions || 0 },
    },
    chartData,
  };
}

/**
 * 2. Moderation Queue Actions
 */
const fetchReportsSchema = z.object({
  status: z.enum(["open", "resolved", "dismissed"]),
});

export async function fetchReportsQueue(params: z.infer<typeof fetchReportsSchema>) {
  await verifyOwnerAccess();
  const { status } = fetchReportsSchema.parse(params);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select(`
      *,
      reporter:profiles!reporter_id(username, display_name, avatar_url),
      post:posts(id, title, content, is_hidden),
      comment:comments(id, body, is_hidden)
    `)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

const moderateReportSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(["hide", "delete", "dismiss"]),
  reason: z.string().max(500).optional(),
});

export async function moderateReportAction(params: z.infer<typeof moderateReportSchema>) {
  const user = await verifyOwnerAccess();
  const { reportId, action, reason } = moderateReportSchema.parse(params);
  const supabase = await createClient();

  // Fetch the report details
  const { data: report, error: fetchErr } = await supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (fetchErr || !report) throw new Error("Report not found");

  const targetId = report.post_id || report.comment_id;
  const targetType = report.post_id ? "post" : "comment";

  if (action === "hide") {
    if (targetType === "post") {
      const { error } = await supabase
        .from("posts")
        .update({ is_hidden: true })
        .eq("id", report.post_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("comments")
        .update({ is_hidden: true })
        .eq("id", report.comment_id);
      if (error) throw new Error(error.message);
    }

    // Set report as resolved
    await supabase.from("reports").update({ status: "resolved" }).eq("id", reportId);
  } else if (action === "delete") {
    if (targetType === "post") {
      const { error } = await supabase.from("posts").delete().eq("id", report.post_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("comments").delete().eq("id", report.comment_id);
      if (error) throw new Error(error.message);
    }

    // Set report as resolved
    await supabase.from("reports").update({ status: "resolved" }).eq("id", reportId);
  } else if (action === "dismiss") {
    const { error } = await supabase
      .from("reports")
      .update({ status: "dismissed" })
      .eq("id", reportId);
    if (error) throw new Error(error.message);
  }

  // Audit log the moderation action
  const { error: logErr } = await supabase.from("moderation_log").insert({
    moderator_id: user.id,
    action: `${action}_${targetType}`,
    target_id: String(targetId),
    target_type: targetType,
    reason: reason || `Action completed via Reports Moderation Dashboard`,
  });

  if (logErr) console.error("Failed to insert moderation audit log:", logErr);
  return { success: true };
}

/**
 * 3. User Directory Actions
 */
const usersFilterSchema = z.object({
  search: z.string().optional(),
  page: z.number().min(1),
  limit: z.number().min(1).max(100),
});

export async function fetchUsersList(params: z.infer<typeof usersFilterSchema>) {
  await verifyOwnerAccess();
  const { search, page, limit } = usersFilterSchema.parse(params);
  const supabase = await createClient();

  let query = supabase.from("profiles").select("*", { count: "exact" });
  if (search && search.trim() !== "") {
    query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
  }

  const { data: profiles, count, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw new Error(error.message);

  if (!profiles || profiles.length === 0) {
    return { users: [], count: 0 };
  }

  // Fetch post counts for the queried profiles
  const profileIds = profiles.map((p) => p.id);
  const { data: postsData } = await supabase
    .from("posts")
    .select("author_id")
    .in("author_id", profileIds);

  const postsCountMap: Record<string, number> = {};
  postsData?.forEach((p) => {
    postsCountMap[p.author_id] = (postsCountMap[p.author_id] || 0) + 1;
  });

  const usersWithCounts = profiles.map((p) => ({
    ...p,
    postCount: postsCountMap[p.id] || 0,
  }));

  return {
    users: usersWithCounts,
    count: count || 0,
  };
}

const roleSchema = z.object({
  targetUserId: z.string().uuid(),
  newRole: z.enum(["owner", "customer"]),
});

export async function updateUserRoleAction(params: z.infer<typeof roleSchema>) {
  const user = await verifyOwnerAccess();
  const { targetUserId, newRole } = roleSchema.parse(params);
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (error) throw new Error(error.message);

  // Audit log
  await supabase.from("moderation_log").insert({
    moderator_id: user.id,
    action: "change_role",
    target_id: targetUserId,
    target_type: "user",
    reason: `Changed user role to ${newRole}`,
  });

  return { success: true };
}

const suspensionSchema = z.object({
  targetUserId: z.string().uuid(),
  suspend: z.boolean(),
  reason: z.string().max(500).optional(),
});

export async function toggleUserSuspensionAction(params: z.infer<typeof suspensionSchema>) {
  const user = await verifyOwnerAccess();
  const { targetUserId, suspend, reason } = suspensionSchema.parse(params);
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ suspended_at: suspend ? new Date().toISOString() : null })
    .eq("id", targetUserId);

  if (error) throw new Error(error.message);

  // Audit log
  await supabase.from("moderation_log").insert({
    moderator_id: user.id,
    action: suspend ? "suspend_user" : "unsuspend_user",
    target_id: targetUserId,
    target_type: "user",
    reason: reason || (suspend ? "User suspended" : "User unsuspended"),
  });

  return { success: true };
}

/**
 * 4. Feature Flags Actions
 */
const flagSchema = z.object({
  flagKey: z.string(),
  enabled: z.boolean(),
});

export async function toggleFeatureFlagAction(params: z.infer<typeof flagSchema>) {
  const user = await verifyOwnerAccess();
  const { flagKey, enabled } = flagSchema.parse(params);
  const supabase = await createClient();

  const { error } = await supabase
    .from("feature_flags")
    .update({ enabled })
    .eq("key", flagKey);

  if (error) throw new Error(error.message);

  // Audit log
  await supabase.from("moderation_log").insert({
    moderator_id: user.id,
    action: "toggle_flag",
    target_id: flagKey,
    target_type: "feature_flag",
    reason: `Toggled flag "${flagKey}" to ${enabled}`,
  });

  return { success: true };
}
