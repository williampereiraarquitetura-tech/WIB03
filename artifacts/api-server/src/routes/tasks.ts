import { db } from "@workspace/db";
import { insertTaskSchema, projectsTable, tasksTable, timelineEventsTable } from "@workspace/db/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

const router = Router();

router.get("/", async (req, res) => {
  const { projectId, priority, status } = req.query;
  const uid = req.user.id;

  const conditions: SQL[] = [eq(tasksTable.userId, uid)];
  if (projectId) conditions.push(eq(tasksTable.projectId, parseInt(projectId as string)));
  if (priority) conditions.push(eq(tasksTable.priority, priority as string));
  if (status) conditions.push(eq(tasksTable.status, status as string));

  const rows = await db
    .select({ task: tasksTable, projectName: projectsTable.name })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(and(...conditions))
    .orderBy(desc(tasksTable.createdAt));

  res.json(rows.map(({ task, projectName }) => ({
    id: task.id, projectId: task.projectId, projectName: projectName ?? undefined,
    title: task.title, description: task.description, priority: task.priority,
    status: task.status, dueDate: task.dueDate, createdAt: task.createdAt.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const parsed = insertTaskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos" }); return; }

  const [task] = await db.insert(tasksTable).values({ ...parsed.data, userId: req.user.id }).returning();

  if (task!.projectId) {
    await db.insert(timelineEventsTable).values({
      projectId: task!.projectId, type: "tarefa_criada", title: "Tarefa criada",
      description: `Tarefa "${task!.title}" foi criada`,
    });
  }

  res.status(201).json({
    id: task!.id, projectId: task!.projectId, title: task!.title, description: task!.description,
    priority: task!.priority, status: task!.status, dueDate: task!.dueDate,
    createdAt: task!.createdAt.toISOString(),
  });
});

const updateSchema = z.object({
  title: z.string().optional(), description: z.string().optional(),
  priority: z.string().optional(), status: z.string().optional(), dueDate: z.string().optional(),
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos" }); return; }

  const [task] = await db.update(tasksTable).set(parsed.data)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, req.user.id)))
    .returning();
  if (!task) { res.status(404).json({ error: "Tarefa não encontrada" }); return; }

  res.json({
    id: task.id, projectId: task.projectId, title: task.title, description: task.description,
    priority: task.priority, status: task.status, dueDate: task.dueDate,
    createdAt: task.createdAt.toISOString(),
  });
});

export default router;
