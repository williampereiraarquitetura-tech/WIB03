import { db } from "@workspace/db";
import { filesTable, insertProjectSchema, peopleTable, projectPeopleTable, projectsTable, tasksTable, timelineEventsTable } from "@workspace/db/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

const router = Router();

router.get("/", async (req, res) => {
  const { status, priority } = req.query;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(projectsTable.status, status as string));
  if (priority) conditions.push(eq(projectsTable.priority, priority as string));

  const rows = await db
    .select()
    .from(projectsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(projectsTable.updatedAt));

  res.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      clientName: p.clientName,
      type: p.type,
      status: p.status,
      priority: p.priority,
      description: p.description,
      aiSummary: p.aiSummary,
      progress: p.progress,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  );
});

router.post("/", async (req, res) => {
  const parsed = insertProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const [project] = await db.insert(projectsTable).values(parsed.data).returning();

  await db.insert(timelineEventsTable).values({
    projectId: project!.id,
    type: "projeto_criado",
    title: "Projeto criado",
    description: `Projeto "${project!.name}" foi criado`,
  });

  res.status(201).json({
    id: project!.id,
    name: project!.name,
    clientName: project!.clientName,
    type: project!.type,
    status: project!.status,
    priority: project!.priority,
    description: project!.description,
    aiSummary: project!.aiSummary,
    progress: project!.progress,
    createdAt: project!.createdAt.toISOString(),
    updatedAt: project!.updatedAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }

  const [tasks, files, timeline, projectPeople] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.projectId, id)).orderBy(desc(tasksTable.createdAt)),
    db.select().from(filesTable).where(eq(filesTable.projectId, id)).orderBy(desc(filesTable.createdAt)),
    db.select().from(timelineEventsTable).where(eq(timelineEventsTable.projectId, id)).orderBy(desc(timelineEventsTable.createdAt)).limit(20),
    db
      .select({ person: peopleTable })
      .from(projectPeopleTable)
      .innerJoin(peopleTable, eq(projectPeopleTable.personId, peopleTable.id))
      .where(eq(projectPeopleTable.projectId, id)),
  ]);

  res.json({
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    type: project.type,
    status: project.status,
    priority: project.priority,
    description: project.description,
    aiSummary: project.aiSummary,
    progress: project.progress,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    tasks: tasks.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      createdAt: t.createdAt.toISOString(),
    })),
    people: projectPeople.map(({ person }) => ({
      id: person.id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      role: person.role,
      organization: person.organization,
      createdAt: person.createdAt.toISOString(),
    })),
    files: files.map((f) => ({
      id: f.id,
      projectId: f.projectId,
      name: f.name,
      fileType: f.fileType,
      url: f.url,
      size: f.size,
      aiSummary: f.aiSummary,
      createdAt: f.createdAt.toISOString(),
    })),
    timeline: timeline.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      type: e.type,
      title: e.title,
      description: e.description,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

const updateSchema = z.object({
  name: z.string().optional(),
  clientName: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  description: z.string().optional(),
  progress: z.number().optional(),
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const [project] = await db
    .update(projectsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projectsTable.id, id))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }

  if (parsed.data.status) {
    await db.insert(timelineEventsTable).values({
      projectId: id,
      type: "status_atualizado",
      title: "Status atualizado",
      description: `Status alterado para "${parsed.data.status}"`,
    });
  }

  res.json({
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    type: project.type,
    status: project.status,
    priority: project.priority,
    description: project.description,
    aiSummary: project.aiSummary,
    progress: project.progress,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

export default router;
