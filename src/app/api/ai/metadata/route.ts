import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAiAccess, checkRateLimit } from "@/lib/ai/rate-limiter";
import { queryGemini } from "@/lib/ai/gemini";
import { metadataPrompt } from "@/lib/ai/prompts";

const requestSchema = z.object({
  draft: z.string().min(1, "Draft content is required"),
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

    const { draft } = result.data;

    // 4. Generate metadata suggestion
    const prompt = metadataPrompt(draft);
    const systemPrompt = "You are a professional SEO copywriter that output only raw, valid JSON.";
    const responseText = await queryGemini(prompt, systemPrompt);

    // 5. Parse response as JSON to make sure it matches contract
    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed.titles) && typeof parsed.description === "string") {
        return NextResponse.json(parsed);
      }
    } catch {
      // In case Claude returned a wrapped markdown JSON or slight formatting variance
      const match = responseText.match(/\{[\s\S]*?\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed.titles) && typeof parsed.description === "string") {
            return NextResponse.json(parsed);
          }
        } catch {
          // ignore
        }
      }
    }

    throw new Error("Failed to generate correct JSON metadata suggestions from AI.");
  } catch (err) {
    const isAuthError =
      err instanceof Error &&
      (err.message === "Unauthorized" || err.message.includes("disabled"));
    const status = isAuthError ? 403 : 500;
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status });
  }
}
