import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role Supabase client — bypasses RLS entirely. Used ONLY by
 * server-only, protocol-level routes that must act outside any specific
 * user's session (e.g. the ActivityPub inbox, which receives requests from
 * remote Mastodon/Threads servers, not from an authenticated app user).
 *
 * Never import this into anything reachable from client code, and never
 * use it for a request that's acting on behalf of a logged-in user — use
 * the normal RLS-governed lib/supabase/server.ts client for that.
 */
export function createServiceClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Fediverse follow requires a service-role key (Supabase project settings → API) to manage ActivityPub keys/followers outside normal user sessions."
    );
  }

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
