"use server";

import { createClient } from "@/lib/supabase/server";
import { backfillMissingEmbeddings } from "@/lib/ai/post-embedding-sync";

/**
 * Personalized "For You" feed: averages the embeddings of posts the
 * authenticated user has finished reading (reading_history.completed_at)
 * into a single interest vector, then finds the nearest not-yet-read
 * published posts via the match_posts pgvector RPC.
 *
 * Returns an empty array (never throws) for signed-out users or users
 * without enough reading history yet — the UI shows a friendly empty
 * state in either case rather than an error.
 */
export async function getPersonalizedFeedAction() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: history } = await supabase
    .from("reading_history")
    .select("post_id")
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(20);

  const readPostIds = (history || []).map((h) => h.post_id as string);
  if (readPostIds.length === 0) return [];

  // Keep the corpus fresh — cheap no-op once everything is embedded
  await backfillMissingEmbeddings(supabase, 3);

  const { data: embeddingRows } = await supabase
    .from("post_embeddings")
    .select("embedding")
    .in("post_id", readPostIds);

  if (!embeddingRows || embeddingRows.length === 0) return [];

  const dimensions = 768;
  const average = new Array(dimensions).fill(0);
  let count = 0;

  for (const row of embeddingRows) {
    const vec = row.embedding as unknown as number[] | string;
    // pgvector may come back as a string like "[0.1,0.2,...]" depending on client parsing
    const parsed = typeof vec === "string" ? JSON.parse(vec) : vec;
    if (!Array.isArray(parsed) || parsed.length !== dimensions) continue;
    for (let i = 0; i < dimensions; i++) average[i] += parsed[i];
    count++;
  }

  if (count === 0) return [];
  for (let i = 0; i < dimensions; i++) average[i] /= count;

  const { data: matches, error: matchError } = await supabase.rpc("match_posts", {
    query_embedding: average,
    match_count: readPostIds.length + 8,
  });

  if (matchError || !matches) return [];

  const readSet = new Set(readPostIds);
  const recommendedIds = (matches as { post_id: string }[])
    .map((m) => m.post_id)
    .filter((id) => !readSet.has(id))
    .slice(0, 6);

  if (recommendedIds.length === 0) return [];

  const { data: posts } = await supabase
    .from("posts")
    .select("*, profiles!author_id(*), reactions(count)")
    .in("id", recommendedIds)
    .eq("status", "published")
    .eq("visibility", "public")
    .eq("is_hidden", false);

  if (!posts) return [];

  // Preserve the similarity-ranked order from the RPC
  const orderIndex = new Map(recommendedIds.map((id, i) => [id, i]));
  return posts.sort((a, b) => (orderIndex.get(a.id) ?? 99) - (orderIndex.get(b.id) ?? 99));
}
