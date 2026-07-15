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
      { status: 200 } // return empty arrays instead of failing hard on client debounce
    );
  }

  const supabase = await createClient();

  try {
    // 1. Fetch posts via Postgres full-text search RPC function
    const { data: posts, error: postsError } = await supabase.rpc("search_posts", {
      search_query: q,
    });

    if (postsError) {
      console.error("Posts search error:", postsError);
    }

    // 2. Fetch profiles/authors matching username or display_name via ILIKE
    const { data: authors, error: authorsError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10);

    if (authorsError) {
      console.error("Authors search error:", authorsError);
    }

    // 3. Fetch tags matching name via ILIKE
    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .select("id, name, slug")
      .ilike("name", `%${q}%`)
      .limit(10);

    if (tagsError) {
      console.error("Tags search error:", tagsError);
    }

    return NextResponse.json({
      posts: posts || [],
      authors: authors || [],
      tags: tags || [],
    });
  } catch (err) {
    console.error("Search API error:", err);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
