import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAiAccess, checkRateLimit } from "@/lib/ai/rate-limiter";
import { queryGemini } from "@/lib/ai/gemini";
import { repurposePrompt } from "@/lib/ai/prompts";

const requestSchema = z.object({
  text: z.string().min(1, "Post content is required"),
  format: z.enum(["twitter_thread", "linkedin_post", "newsletter_blurb"], {
    message: "Format must be twitter_thread, linkedin_post, or newsletter_blurb",
  }),
});

export async function POST(request: Request) {
  try {
    const user = await verifyAiAccess();

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Rate limit is 20 requests per minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const result = requestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { text, format } = result.data;

    const prompt = repurposePrompt(text, format);
    const systemPrompt = "You are a content repurposing assistant. You output only raw, valid JSON.";
    const responseText = await queryGemini(prompt, systemPrompt);

    const tryParse = (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.output === "string") return parsed as { output: string };
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
      throw new Error("Failed to generate repurposed content from AI.");
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const isAuthError =
      err instanceof Error &&
      (err.message === "Unauthorized" || err.message.includes("disabled"));
    const status = isAuthError ? 403 : 500;
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status });
  }
}
