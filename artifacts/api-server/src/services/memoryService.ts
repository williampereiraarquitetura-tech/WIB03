import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { vectorMemoryTable } from "@workspace/db/schema";
import { embedText, embedBatch, chunkText } from "./embeddingService.js";
import { logger } from "../lib/logger.js";

export interface MemoryChunk {
  id: number;
  text: string;
  source: string;
  metadata: unknown;
  distance: number;
}

interface StoreOptions {
  userId: number;
  source: string;
  sourceId?: number;
  text: string;
  metadata?: Record<string, unknown>;
}

interface StoreChunksOptions extends StoreOptions {
  chunkSize?: number;
  overlap?: number;
}

/**
 * Embeds a single piece of text and stores it in vector_memory.
 */
export async function storeMemory(opts: StoreOptions): Promise<void> {
  const embedding = await embedText(opts.text);
  await db.insert(vectorMemoryTable).values({
    userId: opts.userId,
    source: opts.source,
    sourceId: opts.sourceId ?? null,
    text: opts.text,
    embedding,
    metadata: opts.metadata ?? null,
  });
}

/**
 * Splits text into chunks, embeds them in batch, and stores all chunks.
 * Used after file processing to build searchable memory.
 */
export async function storeMemoryChunks(opts: StoreChunksOptions): Promise<void> {
  const chunks = chunkText(opts.text, opts.chunkSize, opts.overlap);
  if (chunks.length === 0) return;

  let embeddings: number[][];
  try {
    embeddings = await embedBatch(chunks);
  } catch (err) {
    logger.warn({ err, source: opts.source }, "Embedding batch failed, skipping memory storage");
    return;
  }

  const rows = chunks.map((chunk, i) => ({
    userId: opts.userId,
    source: opts.source,
    sourceId: opts.sourceId ?? null,
    text: chunk,
    embedding: embeddings[i]!,
    metadata: {
      ...opts.metadata,
      chunkIndex: i,
      totalChunks: chunks.length,
    },
  }));

  await db.insert(vectorMemoryTable).values(rows);
  logger.info({ source: opts.source, chunks: chunks.length, userId: opts.userId }, "Memory chunks stored");
}

/**
 * Finds the most semantically similar memories for a user.
 * Uses pgvector cosine distance (<=>).
 */
export async function retrieveMemory(
  userId: number,
  queryText: string,
  limit = 5,
  sourceFilter?: string,
): Promise<MemoryChunk[]> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(queryText);
  } catch (err) {
    logger.warn({ err }, "Query embedding failed, returning empty memory");
    return [];
  }

  // Format as pgvector literal: [0.1,0.2,...]
  const embStr = `[${queryEmbedding.join(",")}]`;

  const rows = await db.execute(sql`
    SELECT id, text, source, metadata,
           (embedding <=> ${embStr}::vector) AS distance
    FROM vector_memory
    WHERE user_id = ${userId}
    ${sourceFilter ? sql`AND source = ${sourceFilter}` : sql``}
    ORDER BY distance ASC
    LIMIT ${limit}
  `);

  return (rows as any[]).map((r) => ({
    id: Number(r.id),
    text: String(r.text),
    source: String(r.source),
    metadata: r.metadata,
    distance: Number(r.distance),
  }));
}

/**
 * Removes all vector memories for a specific file (e.g., when a file is deleted).
 */
export async function deleteMemoriesBySource(userId: number, sourceId: number): Promise<void> {
  await db.execute(sql`
    DELETE FROM vector_memory
    WHERE user_id = ${userId} AND source_id = ${sourceId}
  `);
}
