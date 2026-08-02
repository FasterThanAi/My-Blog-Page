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

/**
 * Generates an AI cover image for a post the author owns, uploads it to
 * the existing "post-images" storage bucket, and returns the public URL.
 * Requires the caller's GEMINI_API_KEY to have image-generation access —
 * if it doesn't, this returns a clear 502 rather than a silent failure.
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

    // Generate the image
    let image: { base64: string; mimeType: string };
    try {
      image = await generateGeminiImage(coverImagePrompt(title, excerpt));
    } catch (genErr) {
      const message = genErr instanceof Error ? genErr.message : "Image generation failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // Upload to the existing post-images bucket, same path convention as manual uploads
    const ext = image.mimeType.includes("png") ? "png" : image.mimeType.includes("webp") ? "webp" : "jpg";
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
