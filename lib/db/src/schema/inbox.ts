import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inboxItemsTable = pgTable("inbox_items", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  rawTranscription: text("raw_transcription"),
  aiSuggestions: jsonb("ai_suggestions"),
  status: text("status").notNull().default("pending"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInboxSchema = createInsertSchema(inboxItemsTable).omit({ id: true, createdAt: true });
export type InsertInboxItem = z.infer<typeof insertInboxSchema>;
export type InboxItem = typeof inboxItemsTable.$inferSelect;
