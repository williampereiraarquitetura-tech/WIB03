import { boolean, customType, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const MEMORY_TYPES = ["audio", "documento", "factual", "tarefa", "projeto", "conversa"] as const;
export type MemoryType = typeof MEMORY_TYPES[number];

// Maps upload source to semantic memory type
export function sourceToMemoryType(source: string): MemoryType {
  if (source === "audio_chunk") return "audio";
  if (source === "pdf_chunk" || source === "document_chunk") return "documento";
  if (source === "image_chunk") return "factual";
  if (source === "chat_saved") return "conversa";
  return "factual";
}

// pgvector custom type — portable across drizzle-orm versions
const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) { return `vector(${config?.dimensions ?? 1536})`; },
  toDriver(value: number[]): string { return `[${value.join(",")}]`; },
  fromDriver(value: string): number[] { return value.slice(1, -1).split(",").map(Number); },
});

export const vectorMemoryTable = pgTable("vector_memory", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  memoryType: text("memory_type").notNull().default("factual"), // MEMORY_TYPES
  source: text("source").notNull(),      // "audio_chunk" | "pdf_chunk" | "chat_saved" | ...
  sourceId: integer("source_id"),        // files.id or inbox_items.id
  text: text("text").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  important: boolean("important").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VectorMemory = typeof vectorMemoryTable.$inferSelect;
