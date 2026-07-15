import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAiAccess, checkRateLimit } from "@/lib/ai/rate-limiter";
import { queryGeminiVision } from "@/lib/ai/gemini";
import { altTextPrompt } from "@/lib/ai/prompts";

const requestSchema = z.object({
  imageUrl: z.string().min(1, "Image source URL is required"),
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

    const { imageUrl } = result.data;

    let base64Data = "";
    let mediaType = "image/jpeg";

    // 4. Resolve Base64 payload or download from URL
    if (imageUrl.startsWith("data:image/")) {
      const match = imageUrl.match(/^data:(image\/[a-z+]+);base64,(.*)$/);
      if (!match) {
        return NextResponse.json(
          { error: "Malformed base64 data URI image source." },
          { status: 400 }
        );
      }
      mediaType = match[1];
      base64Data = match[2];
    } else {
      // Fetch image URL and convert to base64 buffer
      const res = await fetch(imageUrl);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to download image from source URL (${res.status}).` },
          { status: 400 }
        );
      }
      const arrayBuffer = await res.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString("base64");
      mediaType = res.headers.get("content-type") || "image/jpeg";
    }

    // 5. Query Gemini Vision
    const prompt = altTextPrompt();
    const altText = await queryGeminiVision(base64Data, mediaType, prompt);

    return NextResponse.json({ altText: altText.trim() });
  } catch (err) {
    const isAuthError =
      err instanceof Error &&
      (err.message === "Unauthorized" || err.message.includes("disabled"));
    const status = isAuthError ? 403 : 500;
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status });
  }
}
