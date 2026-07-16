import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const searchInputSchema = z.object({
  q: z.string().min(1, "Search query must be at least 1 character").max(100, "Search query is too long"),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  const validation = searchInputSchema.safeParse({ q });
  if (!validation.success) {
    return NextResponse.json(
      { posts: [], authors: [], tags: [] },
      { status: 200 }
    );
  }

  const supabase = await createClient();

  try {
    // Run all queries concurrently
    const [postsResult, authorsResult, tagsResult] = await Promise.all([
      // 1. Full-text search on title + excerpt
      supabase.rpc("search_posts", { search_query: q }),

      // 2. Authors matching username or display_name
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(10),

      // 3. Tags matching by name
      supabase
        .from("tags")
        .select("id, name, slug")
        .ilike("name", `%${q}%`)
        .limit(10),
    ]);

    if (postsResult.error) {
      console.error("Posts full-text search error:", postsResult.error);
    }
    if (authorsResult.error) {
      console.error("Authors search error:", authorsResult.error);
    }
    if (tagsResult.error) {
      console.error("Tags search error:", tagsResult.error);
    }

    const ftsPosts = postsResult.data || [];
    const tags = tagsResult.data || [];
    const authors = authorsResult.data || [];

    // 4. If tags matched, fetch the posts linked to those tags
    let tagLinkedPosts: typeof ftsPosts = [];
    if (tags.length > 0) {
      const tagIds = tags.map(t => t.id);

      const { data: linkedPostIds } = await supabase
        .from("post_tags")
        .select("post_id")
        .in("tag_id", tagIds);

      if (linkedPostIds && linkedPostIds.length > 0) {
        const postIds = [...new Set(linkedPostIds.map(lp => lp.post_id))];

        const { data: tagPosts } = await supabase
          .from("posts")
          .select("id, author_id, title, slug, excerpt, published_at, profiles!author_id(username, display_name, avatar_url)")
          .eq("status", "published")
          .eq("visibility", "public")
          .eq("is_hidden", false)
          .in("id", postIds)
          .limit(15);

        if (tagPosts) {
          // Cast the Supabase join shape
          type TagPost = {
            id: string;
            author_id: string;
            title: string | null;
            slug: string | null;
            excerpt: string | null;
            published_at: string | null;
            profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
          };

          tagLinkedPosts = (tagPosts as unknown as TagPost[]).map(p => ({
            id: p.id,
            author_id: p.author_id,
            title: p.title ?? "",
            slug: p.slug ?? p.id,
            excerpt: p.excerpt ?? "",
            published_at: p.published_at ?? "",
            author_username: p.profiles?.username ?? "",
            author_display_name: p.profiles?.display_name ?? "",
            author_avatar_url: p.profiles?.avatar_url ?? "",
            headline: p.excerpt ?? "",
            rank: 0.5,
          }));
        }
      }
    }

    // Merge FTS results + tag-linked results, deduplicate by id, FTS wins on duplicate
    type SearchPostShape = {
      id: string;
      author_id?: string;
      title: string;
      slug: string;
      excerpt: string;
      published_at: string;
      author_username: string;
      author_display_name: string;
      author_avatar_url: string;
      headline: string;
      rank: number;
    };
    const merged = new Map<string, SearchPostShape>();
    (tagLinkedPosts as SearchPostShape[]).forEach(p => merged.set(p.id, p));
    (ftsPosts as SearchPostShape[]).forEach(p => merged.set(p.id, p)); // FTS overwrites so it keeps highlighted headline

    const finalPosts = Array.from(merged.values()).sort((a, b) => (b.rank || 0) - (a.rank || 0));

    return NextResponse.json({
      posts: finalPosts,
      authors,
      tags,
    });
  } catch (err) {
    console.error("Search API error:", err);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
