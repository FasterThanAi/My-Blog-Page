import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { actorUrl } from "@/lib/activitypub/site";

export const dynamic = "force-dynamic";

/**
 * ActivityPub followers collection — public, used by remote servers (and
 * our own profile UI) to show follower count/list.
 */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("id, username").eq("username", username).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: followers, count } = await supabase
    .from("activitypub_followers")
    .select("follower_actor_url", { count: "exact" })
    .eq("profile_id", profile.id)
    .limit(50);

  const id = actorUrl(profile.username);

  return NextResponse.json(
    {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${id}/followers`,
      type: "OrderedCollection",
      totalItems: count || 0,
      orderedItems: (followers || []).map((f) => f.follower_actor_url),
    },
    { headers: { "Content-Type": "application/activity+json" } }
  );
}
