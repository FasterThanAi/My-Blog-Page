import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ai/rate-limiter";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Public, read-only Content API — GET /api/public/posts/[slug]
 * Returns a single published post (by slug or id), including full content.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { slug } = await params;

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`public-api:${ip}`)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: CORS_HEADERS });
  }

  const supabase = await createClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);

  let query = supabase
    .from("posts")
    .select(
      "id, title, slug, excerpt, content, cover_image_url, published_at, updated_at, reading_time_minutes, profiles!author_id(username, display_name, avatar_url, bio), post_tags(tags(name, slug))"
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("is_hidden", false);

  query = isUuid ? query.eq("id", slug) : query.eq("slug", slug);

  const { data: post, error } = await query.maybeSingle();

  if (error || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404, headers: CORS_HEADERS });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return NextResponse.json(
    {
      id: post.id,
      title: post.title,
      slug: post.slug || post.id,
      url: `${siteUrl}/post/${post.slug || post.id}`,
      excerpt: post.excerpt,
      content: post.content,
      cover_image_url: post.cover_image_url,
      published_at: post.published_at,
      updated_at: post.updated_at,
      reading_time_minutes: post.reading_time_minutes,
      author: post.profiles,
      tags: (post.post_tags || []).map((pt) => pt.tags).filter(Boolean),
    },
    { headers: CORS_HEADERS }
  );
}
