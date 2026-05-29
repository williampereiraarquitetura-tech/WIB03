import { db } from "@workspace/db";
import { inboxItemsTable, tasksTable, timelineEventsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

const router = Router();

// Inbox statuses:
// pending_processing → AI is queued
// processing         → AI is running
// needs_review       → AI done, waiting for user action
// confirmed          → user confirmed / acted on item
// dismissed          → user dismissed without action
// failed             → AI processing failed

router.get("/", async (req, res) => {
  const { status } = req.query;
  const uid = req.user.id;

  const rows = await db.select().from(inboxItemsTable)
    .where(eq(inboxItemsTable.userId, uid))
    .orderBy(desc(inboxItemsTable.createdAt))
    .limit(50);

  const filtered = status ? rows.filter((item) => item.status === status) : rows;

  res.json(filtered.map((item) => ({
    id: item.id, type: item.type, title: item.title, content: item.content,
    rawTranscription: item.rawTranscription, aiSuggestions: item.aiSuggestions,
    status: item.status, fileUrl: item.fileUrl, createdAt: item.createdAt.toISOString(),
  })));
});

const confirmSchema = z.object({
  projectId: z.number().int().positive().optional(),
  personId: z.number().int().positive().optional(),
  createTasks: z.boolean().optional(),
});

router.post("/:id/confirm", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Corpo da requisição inválido", details: parsed.error.flatten() }); return; }

  const [item] = await db.select().from(inboxItemsTable)
    .where(and(eq(inboxItemsTable.id, id), eq(inboxItemsTable.userId, req.user.id)));
  if (!item) { res.status(404).json({ error: "Item não encontrado" }); return; }

  const { projectId, createTasks } = parsed.data;
  const suggestions = item.aiSuggestions as { tasks?: string[]; priority?: string } | null;

  if (createTasks) {
    const taskTitles = suggestions?.tasks?.length ? suggestions.tasks : [item.title];
    for (const taskTitle of taskTitles) {
      await db.insert(tasksTable).values({
        userId: req.user.id, projectId: projectId ?? null, title: taskTitle,
        priority: suggestions?.priority ?? "importante", status: "pendente",
      });
    }
  }

  if (projectId) {
    await db.insert(timelineEventsTable).values({
      projectId,
      type: item.type === "audio" ? "audio_enviado" : "arquivo_analisado",
      title: item.title,
      description: item.content?.slice(0, 200),
    });
  }

  const [updated] = await db.update(inboxItemsTable)
    .set({ status: "confirmed" })
    .where(eq(inboxItemsTable.id, id))
    .returning();

  res.json({
    id: updated!.id, type: updated!.type, title: updated!.title, content: updated!.content,
    rawTranscription: updated!.rawTranscription, aiSuggestions: updated!.aiSuggestions,
    status: updated!.status, fileUrl: updated!.fileUrl, createdAt: updated!.createdAt.toISOString(),
  });
});

router.post("/:id/dismiss", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [updated] = await db.update(inboxItemsTable)
    .set({ status: "dismissed" })
    .where(and(eq(inboxItemsTable.id, id), eq(inboxItemsTable.userId, req.user.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Item não encontrado" }); return; }

  res.json({
    id: updated.id, type: updated.type, title: updated.title, content: updated.content,
    rawTranscription: updated.rawTranscription, aiSuggestions: updated.aiSuggestions,
    status: updated.status, fileUrl: updated.fileUrl, createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
