import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifyAiAccess, checkRateLimit } from "@/lib/ai/rate-limiter";
import { generateGeminiImage } from "@/lib/ai/gemini";
import { coverImagePrompt } from "@/lib/ai/prompts";

const requestSchema = z.object({
  postId: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(200),
  excerpt: z.string().max(400).optional().default(""),
});

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates an abstract geometric SVG cover image fallback when Gemini AI
 * image quota is exhausted (HTTP 429) or model is unavailable (HTTP 404).
 */
function generateFallbackSvg(title: string): { base64: string; mimeType: string } {
  const gradients = [
    ["#0f172a", "#3b82f6", "#1e1b4b"],
    ["#18181b", "#8b5cf6", "#311b92"],
    ["#022c22", "#10b981", "#064e3b"],
    ["#450a0a", "#f43f5e", "#881337"],
    ["#1e293b", "#06b6d4", "#0f172a"],
  ];

  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  const colors = gradients[Math.abs(hash) % gradients.length];
  const safeTitle = escapeXml(title.length > 60 ? `${title.slice(0, 60)}...` : title);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colors[0]}"/>
        <stop offset="50%" stop-color="${colors[1]}"/>
        <stop offset="100%" stop-color="${colors[2]}"/>
      </linearGradient>
      <filter id="blur">
        <feGaussianBlur stdDeviation="90"/>
      </filter>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="200" cy="150" r="280" fill="${colors[1]}" opacity="0.45" filter="url(#blur)"/>
    <circle cx="1000" cy="500" r="320" fill="${colors[2]}" opacity="0.6" filter="url(#blur)"/>
    <rect x="60" y="60" width="1080" height="510" rx="28" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
    <text x="100" y="320" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="800" fill="#ffffff" letter-spacing="-1">${safeTitle}</text>
  </svg>`;

  return {
    base64: Buffer.from(svg).toString("base64"),
    mimeType: "image/svg+xml",
  };
}

/**
 * Generates an AI cover image for a post the author owns, uploads it to
 * the existing "post-images" storage bucket, and returns the public URL.
 * Includes automatic SVG fallback if Gemini API image quota is exhausted (HTTP 429).
 */
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
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { postId, title, excerpt } = result.data;
    const supabase = await createClient();

    // Ownership check — only the post's author (or platform owner) may generate a cover for it
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .maybeSingle();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (post.author_id !== user.id) {
      return NextResponse.json({ error: "You do not have permission to edit this post." }, { status: 403 });
    }

    // Try Gemini image generation; fall back to SVG gradient cover if quota (429) or model error occurs
    let image: { base64: string; mimeType: string };
    try {
      image = await generateGeminiImage(coverImagePrompt(title, excerpt));
    } catch {
      // Fallback: create abstract gradient cover if Gemini API quota (429) or model endpoint is unavailable
      image = generateFallbackSvg(title);
    }

    // Upload to existing post-images bucket
    const ext = image.mimeType.includes("svg")
      ? "svg"
      : image.mimeType.includes("png")
      ? "png"
      : image.mimeType.includes("webp")
      ? "webp"
      : "jpg";
    const filePath = `${user.id}/${postId}/ai-cover-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(image.base64, "base64");

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(filePath, buffer, { contentType: image.mimeType, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from("post-images").getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (err) {
    const isAuthError =
      err instanceof Error && (err.message === "Unauthorized" || err.message.includes("disabled"));
    const status = isAuthError ? 403 : 500;
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status });
  }
}
