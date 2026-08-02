import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { queryGemini } from "@/lib/ai/gemini";
import { summaryPrompt } from "@/lib/ai/prompts";
import { tiptapToPlainText } from "@/lib/tiptap-text";

const requestSchema = z.object({
  postId: z.string().uuid(),
});

/**
 * Reader-facing AI TL;DR summary. Unlike the editor's AI tools, this is
 * available to anonymous readers (no sign-in required) so it's gated by
 * the platform-wide "ai_assistant" feature flag plus an IP-based rate
 * limit, rather than the per-user editor access check.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = requestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { postId } = result.data;
    const supabase = await createClient();

    // 1. Platform-wide AI feature flag check
    const { data: flag } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "ai_assistant")
      .maybeSingle();

    if (flag && !flag.enabled) {
      return NextResponse.json(
        { error: "AI features are disabled on this platform" },
        { status: 403 }
      );
    }

    // 2. IP-based rate limit (anonymous readers have no user id)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`summary:${ip}`)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429 }
      );
    }

    // 3. Load the published post's content server-side (never trust client-supplied text)
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("content, status, visibility, is_hidden")
      .eq("id", postId)
      .maybeSingle();

    if (postError || !post || post.status !== "published" || post.is_hidden) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const plainText = tiptapToPlainText(post.content);
    if (!plainText || plainText.length < 40) {
      return NextResponse.json(
        { error: "This post is too short to summarize." },
        { status: 400 }
      );
    }

    // 4. Generate the summary
    const prompt = summaryPrompt(plainText);
    const systemPrompt = "You are condensing blog posts into reader-facing summaries. You output only raw, valid JSON.";
    const responseText = await queryGemini(prompt, systemPrompt);

    const tryParse = (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.tldr === "string" && Array.isArray(parsed.bullets)) {
          return parsed as { tldr: string; bullets: string[] };
        }
      } catch {
        // fall through
      }
      return null;
    };

    const parsed = tryParse(responseText) ?? (() => {
      const match = responseText.match(/\{[\s\S]*?\}/);
      return match ? tryParse(match[0]) : null;
    })();

    if (!parsed) {
      throw new Error("Failed to generate a valid summary from AI.");
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
