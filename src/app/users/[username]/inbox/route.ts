import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyInboundSignature, signRequest } from "@/lib/activitypub/http-signature";
import { getOrCreateActorKeys } from "@/lib/activitypub/keys";
import { actorUrl } from "@/lib/activitypub/site";

export const dynamic = "force-dynamic";

interface FollowActivity {
  type: string;
  actor: string;
  object: string;
  id: string;
}

interface RemoteActor {
  id: string;
  inbox: string;
}

/**
 * ActivityPub inbox — receives Follow (and other) activities from remote
 * fediverse servers. Every inbound request's HTTP Signature is verified
 * against the claimed actor's published public key before we trust it;
 * unsigned or forged requests are rejected outright (401) to prevent
 * inbox spoofing (fake followers, forged activities).
 */
export async function POST(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const rawBody = await request.text();

  const verifiedActorId = await verifyInboundSignature(request, rawBody);
  if (!verifiedActorId) {
    return NextResponse.json({ error: "Invalid or missing HTTP signature" }, { status: 401 });
  }

  let activity: FollowActivity;
  try {
    activity = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // The signature must belong to the actor claimed in the activity itself —
  // otherwise a validly-signed request could spoof activities on behalf of
  // a different actor than the one that signed it.
  if (activity.actor !== verifiedActorId) {
    return NextResponse.json({ error: "Actor mismatch between signature and activity" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id, username").eq("username", username).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (activity.type !== "Follow") {
    // Accept receipt but no-op for activity types we don't handle yet
    // (Undo, Like, etc.) — spec-compliant to 202 rather than error.
    return NextResponse.json({ status: "ignored" }, { status: 202 });
  }

  // Fetch the remote actor's inbox so we can deliver our Accept back.
  const remoteActorRes = await fetch(activity.actor, { headers: { Accept: "application/activity+json" } });
  if (!remoteActorRes.ok) {
    return NextResponse.json({ error: "Could not resolve remote actor" }, { status: 502 });
  }
  const remoteActor: RemoteActor = await remoteActorRes.json();

  const service = createServiceClient();
  const { error: insertError } = await service.from("activitypub_followers").upsert(
    {
      profile_id: profile.id,
      follower_actor_url: activity.actor,
      follower_inbox_url: remoteActor.inbox,
    },
    { onConflict: "profile_id,follower_actor_url" }
  );
  if (insertError) {
    return NextResponse.json({ error: "Failed to record follower" }, { status: 500 });
  }

  // Sign and deliver an Accept activity back to the follower's inbox.
  const { privateKeyPem } = await getOrCreateActorKeys(profile.id);
  const localActorId = actorUrl(profile.username);
  const acceptId = `${localActorId}#accepts/${Date.now()}`;
  const acceptBody = JSON.stringify({
    "@context": "https://www.w3.org/ns/activitystreams",
    id: acceptId,
    type: "Accept",
    actor: localActorId,
    object: activity,
  });

  try {
    const remoteInboxUrl = new URL(remoteActor.inbox);
    const headers = signRequest({
      method: "POST",
      targetPath: `${remoteInboxUrl.pathname}${remoteInboxUrl.search}`,
      host: remoteInboxUrl.host,
      body: acceptBody,
      keyId: `${localActorId}#main-key`,
      privateKeyPem,
    });

    await fetch(remoteActor.inbox, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/activity+json" },
      body: acceptBody,
    });
  } catch {
    // Follower is already recorded even if the Accept delivery fails;
    // most fediverse servers treat a stored follow as implicitly accepted.
  }

  return NextResponse.json({ status: "accepted" }, { status: 202 });
}
