import { createClient } from "@/lib/supabase/server";
import { User } from "@supabase/supabase-js";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Checks if a user has exceeded the 20 req/min sliding-window rate limit.
 * Returns true if permitted, false if rate limited.
 */
export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(userId);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (limit.count >= 20) {
    return false;
  }

  limit.count += 1;
  return true;
}

/**
 * Server-side checks to verify if the user has active AI access:
 * 1. User authenticated session exists
 * 2. Feature flag 'ai_assistant' is enabled on the platform
 * 3. Profile setting 'ai_assistant_enabled' is true for the active user
 * 
 * Returns the authenticated User object if valid, otherwise throws an error.
 */
export async function verifyAiAccess(): Promise<User> {
  const supabase = await createClient();

  // 1. Session auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // 2. Platform Feature Flag Check
  const { data: flag, error: flagError } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "ai_assistant")
    .single();

  if (flagError || !flag || !flag.enabled) {
    throw new Error("AI assistant features are disabled on the platform");
  }

  // 3. User Settings Profile Preference Check
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("ai_assistant_enabled")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !profile.ai_assistant_enabled) {
    throw new Error("AI assistant is disabled in your user settings");
  }

  return user;
}
