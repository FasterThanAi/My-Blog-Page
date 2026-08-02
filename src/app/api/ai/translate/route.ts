import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { queryGemini } from "@/lib/ai/gemini";
import { translatePrompt } from "@/lib/ai/prompts";
import { tiptapToParagraphs } from "@/lib/tiptap-text";

const SUPPORTED_LOCALES: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  hi: "Hindi",
  pt: "Portuguese",
  zh: "Simplified Chinese",
};

const requestSchema = z.object({
  postId: z.string().uuid(),
  locale: z.enum(["es", "fr", "de", "ja", "hi", "pt", "zh"]),
});

/**
 * Reader-facing on-demand translation, cached per (post, locale) in
 * post_translations. Public (no sign-in), gated by the platform AI flag
 * plus an IP rate limit, same pattern as /api/ai/summary.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = requestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { postId, locale } = result.data;
    const supabase = await createClient();

    // 1. Check cache first — free repeat reads, no rate limit needed for cache hits
    const { data: cached } = await supabase
      .from("post_translations")
      .select("title, paragraphs")
      .eq("post_id", postId)
      .eq("locale", locale)
      .maybeSingle();

    if (cached) {
      return NextResponse.json(cached);
    }

    // 2. Platform-wide AI feature flag check
    const { data: flag } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "ai_assistant")
      .maybeSingle();

    if (flag && !flag.enabled) {
      return NextResponse.json({ error: "AI features are disabled on this platform" }, { status: 403 });
    }

    // 3. IP-based rate limit
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`translate:${ip}`)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429 }
      );
    }

    // 4. Load the published post's content server-side
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("title, content, status, visibility, is_hidden")
      .eq("id", postId)
      .maybeSingle();

    if (postError || !post || post.status !== "published" || post.is_hidden) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const paragraphs = tiptapToParagraphs(post.content);
    if (paragraphs.length === 0) {
      return NextResponse.json({ error: "This post has no translatable content." }, { status: 400 });
    }

    // 5. Translate
    const targetLanguage = SUPPORTED_LOCALES[locale];
    const prompt = translatePrompt(post.title || "Untitled", paragraphs, targetLanguage);
    const systemPrompt = `You are a professional translator. You output only raw, valid JSON.`;
    const responseText = await queryGemini(prompt, systemPrompt);

    const tryParse = (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.title === "string" && Array.isArray(parsed.paragraphs)) {
          return parsed as { title: string; paragraphs: string[] };
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
      throw new Error("Failed to generate a valid translation from AI.");
    }

    // 6. Cache it (best-effort — don't fail the response if the insert fails)
    await supabase
      .from("post_translations")
      .insert({ post_id: postId, locale, title: parsed.title, paragraphs: parsed.paragraphs })
      .then(
        () => {},
        () => {}
      );

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
