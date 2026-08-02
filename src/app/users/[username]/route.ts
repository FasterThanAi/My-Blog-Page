import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActorPublicKey } from "@/lib/activitypub/keys";
import { actorUrl, getSiteUrl } from "@/lib/activitypub/site";

export const dynamic = "force-dynamic";

/**
 * ActivityPub Actor document — how remote fediverse servers learn this
 * author's public key, inbox/outbox URLs, display name, and avatar.
 */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const publicKeyPem = await getActorPublicKey(profile.id);
  const id = actorUrl(profile.username);

  return NextResponse.json(
    {
      "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
      id,
      type: "Person",
      preferredUsername: profile.username,
      name: profile.display_name || profile.username,
      summary: profile.bio || "",
      url: `${getSiteUrl()}/profile/${profile.username}`,
      inbox: `${id}/inbox`,
      outbox: `${id}/outbox`,
      followers: `${id}/followers`,
      icon: profile.avatar_url
        ? { type: "Image", mediaType: "image/jpeg", url: profile.avatar_url }
        : undefined,
      publicKey: {
        id: `${id}#main-key`,
        owner: id,
        publicKeyPem,
      },
    },
    { headers: { "Content-Type": "application/activity+json" } }
  );
}
