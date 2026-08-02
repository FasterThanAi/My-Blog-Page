import { env } from "@/lib/env";

const EMBEDDING_MODEL = "text-embedding-004";

/**
 * Generates a 768-dimension embedding vector for the given text using
 * Gemini's text-embedding-004 model. Used to populate post_embeddings for
 * semantic search (RAG chatbot + personalized feed).
 */
export async function embedText(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text: text.slice(0, 8000) }] },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Embedding API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const values = data.embedding?.values;

  if (!Array.isArray(values)) {
    throw new Error("Gemini embedding response did not include embedding values.");
  }

  return values as number[];
}

/** Cheap content fingerprint to detect whether a post needs re-embedding. */
export function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${hash}`;
}
