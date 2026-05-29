import { getOpenAIClient } from "./openaiClient.js";

const MODEL = "text-embedding-3-small";
const MAX_INPUT_CHARS = 8000; // safe limit for the model

/**
 * Embeds a single text string.
 * Returns a 1536-dimensional vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  const resp = await client.embeddings.create({
    model: MODEL,
    input: text.slice(0, MAX_INPUT_CHARS),
  });
  return resp.data[0]!.embedding;
}

/**
 * Embeds multiple texts in a single API call (cheaper and faster).
 * Each text is truncated to MAX_INPUT_CHARS.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getOpenAIClient();
  const resp = await client.embeddings.create({
    model: MODEL,
    input: texts.map((t) => t.slice(0, MAX_INPUT_CHARS)),
  });
  // Preserve order — OpenAI returns embeddings in the same order as input
  return resp.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Splits text into overlapping chunks suitable for embedding.
 * chunkSize: target chars per chunk
 * overlap: chars shared between consecutive chunks
 */
export function chunkText(text: string, chunkSize = 800, overlap = 150): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= chunkSize) return trimmed ? [trimmed] : [];

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    const end = Math.min(start + chunkSize, trimmed.length);
    const chunk = trimmed.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start += chunkSize - overlap;
    if (start >= trimmed.length) break;
  }

  return chunks;
}
