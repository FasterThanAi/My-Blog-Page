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

/**
 * Public, read-only Content API — GET /api/public/posts
 * Query params: limit (max 50, default 20), page (1-based), tag (slug)
 * Lists published, public posts for headless/third-party consumption.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`public-api:${ip}`)) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const tagSlug = searchParams.get("tag");
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select(
      "id, title, slug, excerpt, cover_image_url, published_at, reading_time_minutes, profiles!author_id(username, display_name, avatar_url), post_tags(tags(name, slug))",
      { count: "exact" }
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("is_hidden", false)
    .order("published_at", { ascending: false })
    .range(from, to);

  if (tagSlug) {
    const { data: tag } = await supabase.from("tags").select("id").eq("slug", tagSlug).maybeSingle();
    if (!tag) {
      return NextResponse.json({ data: [], page, limit, total: 0 }, { headers: CORS_HEADERS });
    }
    const { data: linked } = await supabase.from("post_tags").select("post_id").eq("tag_id", tag.id);
    const ids = (linked || []).map((l) => l.post_id);
    if (ids.length === 0) {
      return NextResponse.json({ data: [], page, limit, total: 0 }, { headers: CORS_HEADERS });
    }
    query = query.in("id", ids);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const posts = (data || []).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug || p.id,
    url: `${siteUrl}/post/${p.slug || p.id}`,
    excerpt: p.excerpt,
    cover_image_url: p.cover_image_url,
    published_at: p.published_at,
    reading_time_minutes: p.reading_time_minutes,
    author: p.profiles,
    tags: (p.post_tags || []).map((pt) => pt.tags).filter(Boolean),
  }));

  return NextResponse.json(
    { data: posts, page, limit, total: count || 0 },
    { headers: CORS_HEADERS }
  );
}
