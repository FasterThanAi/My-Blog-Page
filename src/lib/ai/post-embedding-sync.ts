import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText, hashContent } from "@/lib/ai/embeddings";
import { tiptapToPlainText } from "@/lib/tiptap-text";

/**
 * (Re-)embeds a single post into post_embeddings if its content has
 * changed since the last embedding (tracked via a cheap content hash).
 * Swallows its own errors — embedding is a best-effort enhancement that
 * should never break the caller's primary flow (publishing, chatting).
 */
export async function syncPostEmbedding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  postId: string
): Promise<void> {
  try {
    const { data: post } = await supabase
      .from("posts")
      .select("title, excerpt, content, status, visibility, is_hidden")
      .eq("id", postId)
      .maybeSingle();

    if (!post || post.status !== "published" || post.visibility !== "public" || post.is_hidden) {
      return;
    }

    const plainText = tiptapToPlainText(post.content);
    const fingerprint = `${post.title}|${post.excerpt}|${plainText}`;
    const contentHash = hashContent(fingerprint);

    const { data: existing } = await supabase
      .from("post_embeddings")
      .select("content_hash")
      .eq("post_id", postId)
      .maybeSingle();

    if (existing && existing.content_hash === contentHash) {
      return; // Already up to date
    }

    const embeddingInput = `${post.title}\n\n${post.excerpt || ""}\n\n${plainText}`.trim();
    if (embeddingInput.length < 20) return;

    const embedding = await embedText(embeddingInput);

    await supabase.from("post_embeddings").upsert(
      {
        post_id: postId,
        embedding,
        content_hash: contentHash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "post_id" }
    );
  } catch (err) {
    console.error("Post embedding sync error:", err);
  }
}

/**
 * Embeds a small batch of published posts that don't have an embedding
 * yet. Called opportunistically from the RAG chatbot/personalized feed so
 * older posts (published before this feature existed) get backfilled
 * gradually as the features get used, without a one-off admin script.
 */
export async function backfillMissingEmbeddings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  limit: number = 3
): Promise<void> {
  try {
    const { data: embedded } = await supabase.from("post_embeddings").select("post_id");
    const embeddedIds = new Set((embedded || []).map((r: { post_id: string }) => r.post_id));

    const { data: posts } = await supabase
      .from("posts")
      .select("id")
      .eq("status", "published")
      .eq("visibility", "public")
      .eq("is_hidden", false)
      .order("published_at", { ascending: false })
      .limit(50);

    const missing = (posts || []).filter((p: { id: string }) => !embeddedIds.has(p.id)).slice(0, limit);

    for (const p of missing) {
      await syncPostEmbedding(supabase, p.id);
    }
  } catch (err) {
    console.error("Embedding backfill error:", err);
  }
}
