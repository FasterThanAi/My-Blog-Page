import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { queryGemini } from "@/lib/ai/gemini";
import { embedText } from "@/lib/ai/embeddings";
import { ragChatPrompt } from "@/lib/ai/prompts";
import { backfillMissingEmbeddings } from "@/lib/ai/post-embedding-sync";
import { tiptapToPlainText } from "@/lib/tiptap-text";

const requestSchema = z.object({
  question: z.string().min(3, "Ask a slightly longer question").max(500),
});

/**
 * "Ask the Archive" RAG chatbot: embeds the question, finds the most
 * semantically similar posts via the match_posts RPC (pgvector cosine
 * search), and asks Gemini to answer strictly from those excerpts, citing
 * sources. Public (no sign-in), gated by the AI flag + IP rate limit.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = requestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { question } = result.data;
    const supabase = await createClient();

    // 1. Platform AI flag
    const { data: flag } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "ai_assistant")
      .maybeSingle();

    if (flag && !flag.enabled) {
      return NextResponse.json({ error: "AI features are disabled on this platform" }, { status: 403 });
    }

    // 2. IP rate limit
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`chat:${ip}`)) {
      return NextResponse.json({ error: "Too many requests. Please try again in a minute." }, { status: 429 });
    }

    // 3. Opportunistically backfill a few missing embeddings (older posts)
    try {
      await backfillMissingEmbeddings(supabase, 3);
    } catch {
      // Ignore background sync errors
    }

    // 4. Try vector similarity match via match_posts RPC
    type PostRow = { id: string; title: string | null; slug: string | null; excerpt: string | null; content: unknown };
    let matchedPosts: PostRow[] = [];

    try {
      const questionEmbedding = await embedText(question);
      const { data: matches, error: matchError } = await supabase.rpc("match_posts", {
        query_embedding: questionEmbedding,
        match_count: 5,
      });

      if (!matchError && Array.isArray(matches) && matches.length > 0) {
        const matchRows = matches as { post_id: string; similarity: number }[];
        const postIds = matchRows.map((m) => m.post_id);
        const { data: vectorPosts } = await supabase
          .from("posts")
          .select("id, title, slug, excerpt, content")
          .in("id", postIds);

        if (vectorPosts && vectorPosts.length > 0) {
          const postsMap = new Map((vectorPosts as PostRow[]).map((p) => [p.id, p]));
          matchedPosts = matchRows.map((m) => postsMap.get(m.post_id)).filter((p): p is PostRow => p !== undefined);
        }
      }
    } catch {
      // Vector RPC missing or errored — fallback to keyword text search below
    }

    // Fallback: Keyword search across published posts if vector search returned nothing or RPC is missing
    if (matchedPosts.length === 0) {
      const keywords = question
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 3);

      let query = supabase
        .from("posts")
        .select("id, title, slug, excerpt, content")
        .eq("status", "published")
        .eq("visibility", "public")
        .eq("is_hidden", false)
        .order("published_at", { ascending: false })
        .limit(5);

      if (keywords.length > 0) {
        query = query.or(keywords.map((k) => `title.ilike.%${k}%,excerpt.ilike.%${k}%`).join(","));
      }

      const { data: fallbackPosts } = await query;
      if (fallbackPosts && fallbackPosts.length > 0) {
        matchedPosts = fallbackPosts as PostRow[];
      } else {
        // Ultimate fallback: get most recent published posts
        const { data: latestPosts } = await supabase
          .from("posts")
          .select("id, title, slug, excerpt, content")
          .eq("status", "published")
          .eq("visibility", "public")
          .eq("is_hidden", false)
          .order("published_at", { ascending: false })
          .limit(5);

        matchedPosts = (latestPosts || []) as PostRow[];
      }
    }

    if (matchedPosts.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find any published posts in the archive relevant to that question yet.",
        sources: [],
      });
    }

    // 5. Build excerpts for Gemini prompt
    type ExcerptItem = { index: number; title: string; text: string };
    const excerpts: ExcerptItem[] = matchedPosts.map((post, i) => {
      const text = (post.excerpt || tiptapToPlainText(post.content, 800)).slice(0, 800);
      return { index: i + 1, title: post.title || "Untitled", text };
    });

    // 6. Ask Gemini to answer strictly from the excerpts
    const prompt = ragChatPrompt(question, excerpts);
    const systemPrompt = "You are a research assistant answering strictly from provided excerpts. You output only raw, valid JSON.";
    const responseText = await queryGemini(prompt, systemPrompt);

    const tryParse = (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.answer === "string") {
          return parsed as { answer: string; citedIndexes?: number[] };
        }
      } catch {
        // fall through
      }
      return null;
    };

    const parsed = tryParse(responseText) ?? (() => {
      const match = responseText.match(/\{[\s\S]*\}/);
      return match ? tryParse(match[0]) : null;
    })();

    if (!parsed) {
      throw new Error("Failed to generate an answer from AI.");
    }

    const citedIndexes = new Set(parsed.citedIndexes && parsed.citedIndexes.length > 0
      ? parsed.citedIndexes
      : excerpts.map((e) => e.index));

    const sources = excerpts
      .filter((e) => citedIndexes.has(e.index))
      .map((e) => {
        const post = matchedPosts[e.index - 1];
        return post ? { postId: post.id, title: post.title || "Untitled", slug: post.slug || post.id } : null;
      })
      .filter((s): s is { postId: string; title: string; slug: string } => s !== null);

    return NextResponse.json({ answer: parsed.answer, sources });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
