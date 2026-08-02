import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { actorUrl, getSiteUrl } from "@/lib/activitypub/site";

export const dynamic = "force-dynamic";

/**
 * ActivityPub outbox — exposes recent published posts as an
 * OrderedCollection of Create/Article activities, so fediverse followers'
 * timelines can display this author's posts.
 */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("id, username, display_name").eq("username", username).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, title, excerpt, published_at")
    .eq("author_id", profile.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);

  const id = actorUrl(profile.username);
  const items = (posts || []).map((post) => {
    const postUrl = `${getSiteUrl()}/post/${post.slug}`;
    return {
      id: `${postUrl}#activity`,
      type: "Create",
      actor: id,
      published: post.published_at,
      object: {
        id: postUrl,
        type: "Article",
        attributedTo: id,
        name: post.title,
        summary: post.excerpt || "",
        url: postUrl,
        published: post.published_at,
      },
    };
  });

  return NextResponse.json(
    {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${id}/outbox`,
      type: "OrderedCollection",
      totalItems: items.length,
      orderedItems: items,
    },
    { headers: { "Content-Type": "application/activity+json" } }
  );
}
