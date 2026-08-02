import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { actorUrl, getSiteDomain } from "@/lib/activitypub/site";

export const dynamic = "force-dynamic";

/**
 * WebFinger — how Mastodon/Threads resolve "@username@yourdomain" to an
 * ActivityPub actor URL. Required first step of the fediverse follow flow.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") || "";

  const match = resource.match(/^acct:([^@]+)@(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
  }

  const [, username, domain] = match;
  if (domain !== getSiteDomain()) {
    return NextResponse.json({ error: "Domain mismatch" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("username").eq("username", username).maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      subject: `acct:${username}@${getSiteDomain()}`,
      links: [
        {
          rel: "self",
          type: "application/activity+json",
          href: actorUrl(username),
        },
      ],
    },
    { headers: { "Content-Type": "application/jrd+json" } }
  );
}
