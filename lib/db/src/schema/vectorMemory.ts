import { customType, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// pgvector custom type — portable across drizzle-orm versions
const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(",").map(Number);
  },
});

export const vectorMemoryTable = pgTable("vector_memory", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  source: text("source").notNull(), // "audio_chunk" | "image_chunk" | "pdf_chunk" | "document_chunk"
  sourceId: integer("source_id"),   // files.id or inbox_items.id
  text: text("text").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  metadata: jsonb("metadata"),      // { fileType, projectId, originalName, chunkIndex, totalChunks }
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VectorMemory = typeof vectorMemoryTable.$inferSelect;
