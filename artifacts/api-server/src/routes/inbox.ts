import { db } from "@workspace/db";
import { inboxItemsTable, tasksTable, timelineEventsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

const router = Router();

router.get("/", async (req, res) => {
  const { status } = req.query;
  const rows = await db.select().from(inboxItemsTable).orderBy(desc(inboxItemsTable.createdAt)).limit(50);

  const filtered = rows.filter((item) => {
    if (status && item.status !== status) return false;
    return true;
  });

  res.json(
    filtered.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      content: item.content,
      rawTranscription: item.rawTranscription,
      aiSuggestions: item.aiSuggestions,
      status: item.status,
      fileUrl: item.fileUrl,
      createdAt: item.createdAt.toISOString(),
    }))
  );
});

const confirmSchema = z.object({
  projectId: z.number().optional(),
  personId: z.number().optional(),
  createTasks: z.boolean().optional(),
});

router.post("/:id/confirm", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const parsed = confirmSchema.safeParse(req.body);

  const [item] = await db.select().from(inboxItemsTable).where(eq(inboxItemsTable.id, id));
  if (!item) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }

  const suggestions = item.aiSuggestions as { tasks?: string[]; priority?: string } | null;

  if (parsed.success && parsed.data.createTasks && suggestions?.tasks && parsed.data.projectId) {
    for (const taskTitle of suggestions.tasks) {
      await db.insert(tasksTable).values({
        projectId: parsed.data.projectId,
        title: taskTitle,
        priority: suggestions.priority ?? "importante",
        status: "pendente",
      });
    }
  }

  if (parsed.success && parsed.data.projectId) {
    await db.insert(timelineEventsTable).values({
      projectId: parsed.data.projectId,
      type: item.type === "audio" ? "audio_enviado" : "arquivo_analisado",
      title: item.title,
      description: item.content?.slice(0, 200),
    });
  }

  const [updated] = await db
    .update(inboxItemsTable)
    .set({ status: "confirmed" })
    .where(eq(inboxItemsTable.id, id))
    .returning();

  res.json({
    id: updated!.id,
    type: updated!.type,
    title: updated!.title,
    content: updated!.content,
    rawTranscription: updated!.rawTranscription,
    aiSuggestions: updated!.aiSuggestions,
    status: updated!.status,
    fileUrl: updated!.fileUrl,
    createdAt: updated!.createdAt.toISOString(),
  });
});

router.post("/:id/dismiss", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [updated] = await db
    .update(inboxItemsTable)
    .set({ status: "dismissed" })
    .where(eq(inboxItemsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }

  res.json({
    id: updated.id,
    type: updated.type,
    title: updated.title,
    content: updated.content,
    rawTranscription: updated.rawTranscription,
    aiSuggestions: updated.aiSuggestions,
    status: updated.status,
    fileUrl: updated.fileUrl,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
