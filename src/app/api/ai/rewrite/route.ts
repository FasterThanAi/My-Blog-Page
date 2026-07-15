import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAiAccess, checkRateLimit } from "@/lib/ai/rate-limiter";
import { streamGemini } from "@/lib/ai/gemini";
import { rewritePrompt } from "@/lib/ai/prompts";

const requestSchema = z.object({
  text: z.string().min(1, "Text input is required"),
  tone: z.enum(["concise", "formal", "friendly", "simpler"], {
    message: "Tone must be concise, formal, friendly, or simpler",
  }),
});

export async function POST(request: Request) {
  try {
    // 1. Verify Platform/User Permissions
    const user = await verifyAiAccess();

    // 2. Enforce Rate Limiting
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Rate limit is 20 requests per minute." },
        { status: 429 }
      );
    }

    // 3. Parse and Validate Request
    const body = await request.json();
    const result = requestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { text, tone } = result.data;

    // 4. Stream response from Gemini
    const prompt = rewritePrompt(text, tone);
    const systemPrompt = `You are a professional writing editor, specialized in rewritng text in a ${tone} tone.`;
    const stream = await streamGemini(prompt, systemPrompt);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    const isAuthError =
      err instanceof Error &&
      (err.message === "Unauthorized" || err.message.includes("disabled"));
    const status = isAuthError ? 403 : 500;
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status });
  }
}
