import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { vectorMemoryTable, sourceToMemoryType } from "@workspace/db/schema";
import type { MemoryType } from "@workspace/db/schema";
import { embedText, embedBatch, chunkText } from "./embeddingService.js";
import { logger } from "../lib/logger.js";

// Cosine distance threshold for deduplication (0 = identical, 2 = opposite)
const DEDUP_DISTANCE = 0.12;

// Default max distance for retrieval — results above this are irrelevant
const DEFAULT_MAX_DISTANCE = 0.82;

export interface MemoryChunk {
  id: number;
  text: string;
  source: string;
  memoryType: string;
  important: boolean;
  metadata: unknown;
  distance: number;
}

export interface MemoryRecord {
  id: number;
  memoryType: string;
  source: string;
  sourceId: number | null;
  text: string;
  important: boolean;
  metadata: unknown;
  createdAt: string;
}

interface StoreOptions {
  userId: number;
  source: string;
  sourceId?: number;
  text: string;
  metadata?: Record<string, unknown>;
  memoryType?: MemoryType;
  important?: boolean;
}

interface StoreChunksOptions extends StoreOptions {
  chunkSize?: number;
  overlap?: number;
}

// ─── Deduplication check ──────────────────────────────────────────────────────

async function isDuplicate(userId: number, embStr: string): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT 1 FROM vector_memory
    WHERE user_id = ${userId}
      AND (embedding <=> ${embStr}::vector) < ${DEDUP_DISTANCE}
    LIMIT 1
  `);
  return (rows as any[]).length > 0;
}

// ─── Store single chunk ───────────────────────────────────────────────────────

export async function storeMemory(opts: StoreOptions): Promise<void> {
  let embedding: number[];
  try {
    embedding = await embedText(opts.text);
  } catch (err) {
    logger.warn({ err }, "Embedding failed, skipping memory store");
    return;
  }

  const embStr = `[${embedding.join(",")}]`;
  if (await isDuplicate(opts.userId, embStr)) {
    logger.debug({ source: opts.source, userId: opts.userId }, "Duplicate memory skipped");
    return;
  }

  const memoryType = opts.memoryType ?? sourceToMemoryType(opts.source);

  await db.insert(vectorMemoryTable).values({
    userId: opts.userId,
    memoryType,
    source: opts.source,
    sourceId: opts.sourceId ?? null,
    text: opts.text,
    embedding,
    important: opts.important ?? false,
    metadata: opts.metadata ?? null,
  });
}

// ─── Store multiple chunks (batch embed + dedup each) ────────────────────────

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

  const memoryType = opts.memoryType ?? sourceToMemoryType(opts.source);
  let stored = 0;

  for (let i = 0; i < chunks.length; i++) {
    const embStr = `[${embeddings[i]!.join(",")}]`;
    if (await isDuplicate(opts.userId, embStr)) continue;

    await db.insert(vectorMemoryTable).values({
      userId: opts.userId,
      memoryType,
      source: opts.source,
      sourceId: opts.sourceId ?? null,
      text: chunks[i]!,
      embedding: embeddings[i]!,
      important: false,
      metadata: { ...opts.metadata, chunkIndex: i, totalChunks: chunks.length },
    });
    stored++;
  }

  logger.info({ source: opts.source, total: chunks.length, stored, userId: opts.userId }, "Memory chunks stored");
}

// ─── Retrieve similar memories ────────────────────────────────────────────────

export async function retrieveMemory(
  userId: number,
  queryText: string,
  limit = 5,
  maxDistance = DEFAULT_MAX_DISTANCE,
  typeFilter?: MemoryType,
): Promise<MemoryChunk[]> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(queryText);
  } catch (err) {
    logger.warn({ err }, "Query embedding failed, returning empty memory");
    return [];
  }

  const embStr = `[${queryEmbedding.join(",")}]`;

  const rows = await db.execute(sql`
    SELECT id, text, source, memory_type, important, metadata,
           (embedding <=> ${embStr}::vector) AS distance
    FROM vector_memory
    WHERE user_id = ${userId}
      AND (embedding <=> ${embStr}::vector) < ${maxDistance}
      ${typeFilter ? sql`AND memory_type = ${typeFilter}` : sql``}
    ORDER BY distance ASC
    LIMIT ${limit}
  `);

  return (rows as any[]).map((r) => ({
    id: Number(r.id),
    text: String(r.text),
    source: String(r.source),
    memoryType: String(r.memory_type),
    important: Boolean(r.important),
    metadata: r.metadata,
    distance: Number(r.distance),
  }));
}

// ─── List memories (for review screen) ───────────────────────────────────────

export async function listMemories(
  userId: number,
  opts: { type?: MemoryType; limit?: number; offset?: number } = {},
): Promise<{ memories: MemoryRecord[]; total: number }> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const typeClause = opts.type ? sql`AND memory_type = ${opts.type}` : sql``;

  const [rows, countRows] = await Promise.all([
    db.execute(sql`
      SELECT id, memory_type, source, source_id, text, important, metadata, created_at
      FROM vector_memory
      WHERE user_id = ${userId}
        ${typeClause}
      ORDER BY important DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM vector_memory
      WHERE user_id = ${userId}
        ${typeClause}
    `),
  ]);

  const memories = (rows as any[]).map((r) => ({
    id: Number(r.id),
    memoryType: String(r.memory_type),
    source: String(r.source),
    sourceId: r.source_id ? Number(r.source_id) : null,
    text: String(r.text),
    important: Boolean(r.important),
    metadata: r.metadata,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  const total = Number((countRows as any[])[0]?.total ?? 0);
  return { memories, total };
}

// ─── Update a memory ─────────────────────────────────────────────────────────

export async function updateMemory(
  userId: number,
  memoryId: number,
  patch: { memoryType?: MemoryType; important?: boolean },
): Promise<boolean> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (patch.memoryType !== undefined) {
    setClauses.push(`memory_type = $${values.push(patch.memoryType)}`);
  }
  if (patch.important !== undefined) {
    setClauses.push(`important = $${values.push(patch.important)}`);
  }

  if (setClauses.length === 0) return false;

  const result = await db.execute(sql`
    UPDATE vector_memory
    SET ${sql.raw(setClauses.join(", "))}
    WHERE id = ${memoryId} AND user_id = ${userId}
    RETURNING id
  `);

  return (result as any[]).length > 0;
}

// ─── Delete a memory ─────────────────────────────────────────────────────────

export async function deleteMemory(userId: number, memoryId: number): Promise<boolean> {
  const result = await db.execute(sql`
    DELETE FROM vector_memory
    WHERE id = ${memoryId} AND user_id = ${userId}
    RETURNING id
  `);
  return (result as any[]).length > 0;
}

export async function deleteMemoriesBySource(userId: number, sourceId: number): Promise<void> {
  await db.execute(sql`
    DELETE FROM vector_memory WHERE user_id = ${userId} AND source_id = ${sourceId}
  `);
}

// ─── Clear all memories for user ─────────────────────────────────────────────

export async function clearAllMemories(userId: number): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM vector_memory WHERE user_id = ${userId} RETURNING id
  `);
  return (result as any[]).length;
}
