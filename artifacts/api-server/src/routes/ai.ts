import { db } from "@workspace/db";
import { inboxItemsTable, projectsTable, tasksTable, timelineEventsTable, filesTable, peopleTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { Router } from "express";
import { getOpenAIClient } from "../services/openaiClient.js";
import { retrieveMemory, storeMemory, listMemories, deleteMemory, updateMemory, clearAllMemories } from "../services/memoryService.js";
import type { MemoryType } from "@workspace/db/schema";

const router = Router();

router.get("/today", async (req, res) => {
  const uid = req.user.id;

  const [urgentTasks, pendingInboxCount, recentEvents, blockedProjects] = await Promise.all([
    db.select({ task: tasksTable, projectName: projectsTable.name })
      .from(tasksTable)
      .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(and(eq(tasksTable.userId, uid), eq(tasksTable.status, "pendente")))
      .orderBy(desc(tasksTable.createdAt))
      .limit(20),
    db.select().from(inboxItemsTable)
      .where(and(eq(inboxItemsTable.userId, uid), eq(inboxItemsTable.status, "needs_review"))),
    db.select({ event: timelineEventsTable, projectName: projectsTable.name })
      .from(timelineEventsTable)
      .leftJoin(projectsTable, eq(timelineEventsTable.projectId, projectsTable.id))
      .where(eq(projectsTable.userId, uid))
      .orderBy(desc(timelineEventsTable.createdAt))
      .limit(5),
    db.select().from(projectsTable)
      .where(and(eq(projectsTable.userId, uid), eq(projectsTable.status, "bloqueado"))),
  ]);

  let aiSummary = "";
  try {
    const client = getOpenAIClient();
    const context = `
Projetos bloqueados: ${blockedProjects.length}
Itens pendentes na inbox: ${pendingInboxCount.length}
Tarefas urgentes: ${urgentTasks.map(({ task }) => task.title).join(", ") || "nenhuma"}
    `.trim();

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é o WIB. Crie um resumo executivo do dia em 1-2 frases objetivas baseado no contexto." },
        { role: "user", content: context },
      ],
      max_tokens: 150,
    });
    aiSummary = resp.choices[0]?.message?.content ?? "";
  } catch {
    aiSummary = "Confira suas prioridades e inbox abaixo.";
  }

  res.json({
    aiSummary,
    urgentTasks: urgentTasks.map(({ task, projectName }) => ({
      id: task.id, projectId: task.projectId, projectName: projectName ?? undefined,
      title: task.title, description: task.description, priority: task.priority,
      status: task.status, dueDate: task.dueDate, createdAt: task.createdAt.toISOString(),
    })),
    blockedProjects: blockedProjects.length,
    pendingInbox: pendingInboxCount.length,
    recentEvents: recentEvents.map(({ event, projectName }) => ({
      id: event.id, projectId: event.projectId, projectName: projectName ?? undefined,
      type: event.type, title: event.title, description: event.description,
      createdAt: event.createdAt.toISOString(),
    })),
  });
});

router.post("/chat", async (req, res) => {
  const { message, history = [] } = req.body as { message: string; history?: { role: string; content: string }[] };
  if (!message) { res.status(400).json({ error: "Mensagem é obrigatória" }); return; }

  const uid = req.user.id;

  const [projects, tasks, people, memories] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.userId, uid)).orderBy(desc(projectsTable.updatedAt)).limit(10),
    db.select().from(tasksTable).where(and(eq(tasksTable.userId, uid), eq(tasksTable.status, "pendente"))).limit(10),
    db.select().from(peopleTable).where(eq(peopleTable.userId, uid)).limit(10),
    retrieveMemory(uid, message, 5).catch(() => []),
  ]);

  const memoryContext = memories.length > 0
    ? memories.map((m) => `[${m.source.replace("_chunk", "")}] ${m.text}`).join("\n\n")
    : "";

  const context = `
PROJETOS: ${projects.map((p) => `${p.name} (${p.status})`).join(", ") || "nenhum"}
TAREFAS PENDENTES: ${tasks.map((t) => `${t.title} [${t.priority}]`).join(", ") || "nenhuma"}
PESSOAS: ${people.map((p) => `${p.name} (${p.role})`).join(", ") || "nenhuma"}
  `.trim();

  // Build deduplicated source list from retrieved memories
  const sources = memories.map((m) => {
    const meta = m.metadata as Record<string, unknown> | null;
    const originalName = meta?.originalName as string | undefined;
    const label = originalName ?? m.memoryType;
    return {
      memoryType: m.memoryType,
      source: m.source,
      label,
      preview: m.text.slice(0, 120),
      distance: Number(m.distance.toFixed(3)),
    };
  }).filter((s, i, arr) =>
    // deduplicate by label — keep first occurrence of each file name
    arr.findIndex((x) => x.label === s.label) === i
  );

  let aiResponse = "";
  const suggestedActions: string[] = [];

  try {
    const client = getOpenAIClient();
    const systemPrompt = [
      "Você é o WIB, um assistente de segundo cérebro especializado em projetos urbanísticos, aprovações municipais e incorporações imobiliárias. Responda em português de forma objetiva e útil.",
      "",
      "CONTEXTO ATUAL:",
      context,
      ...(memoryContext ? ["", "MEMÓRIA RELEVANTE (de arquivos e capturas anteriores):", memoryContext] : []),
    ].join("\n");

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user", content: message },
      ],
      max_tokens: 800,
    });
    aiResponse = resp.choices[0]?.message?.content ?? "Não foi possível processar sua pergunta.";
    if (projects.length === 0) suggestedActions.push("Cadastrar primeiro projeto");
    if (tasks.length > 3) suggestedActions.push("Ver tarefas urgentes");
  } catch {
    aiResponse = "Desculpe, não foi possível processar sua pergunta no momento.";
  }

  res.json({ message: aiResponse, suggestedActions, sources });
});

router.get("/search", async (req, res) => {
  const { q } = req.query as { q: string };
  if (!q) { res.status(400).json({ error: "Parâmetro 'q' é obrigatório" }); return; }

  const uid = req.user.id;
  const search = q.toLowerCase();

  const [allProjects, allPeople, allTasks, allFiles] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.userId, uid)),
    db.select().from(peopleTable).where(eq(peopleTable.userId, uid)),
    db.select().from(tasksTable).where(eq(tasksTable.userId, uid)),
    db.select().from(filesTable).where(eq(filesTable.userId, uid)),
  ]);

  const matchedProjects = allProjects.filter(
    (p) => p.name.toLowerCase().includes(search) || (p.clientName ?? "").toLowerCase().includes(search) || (p.description ?? "").toLowerCase().includes(search)
  );
  const matchedPeople = allPeople.filter(
    (p) => p.name.toLowerCase().includes(search) || (p.organization ?? "").toLowerCase().includes(search)
  );
  const matchedTasks = allTasks.filter(
    (t) => t.title.toLowerCase().includes(search) || (t.description ?? "").toLowerCase().includes(search)
  );
  const matchedFiles = allFiles.filter(
    (f) => f.name.toLowerCase().includes(search) || (f.aiSummary ?? "").toLowerCase().includes(search)
  );

  let aiAnswer = "";
  try {
    const client = getOpenAIClient();
    const context = [
      matchedProjects.length > 0 ? `Projetos: ${matchedProjects.map((p) => p.name).join(", ")}` : "",
      matchedPeople.length > 0 ? `Pessoas: ${matchedPeople.map((p) => p.name).join(", ")}` : "",
      matchedTasks.length > 0 ? `Tarefas: ${matchedTasks.map((t) => t.title).join(", ")}` : "",
    ].filter(Boolean).join("\n");
    if (context) {
      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é o WIB. Com base nos resultados encontrados, responda a pergunta do usuário de forma objetiva." },
          { role: "user", content: `Pergunta: "${q}"\n\nResultados: ${context}` },
        ],
        max_tokens: 300,
      });
      aiAnswer = resp.choices[0]?.message?.content ?? "";
    }
  } catch { /* ignore */ }

  res.json({
    projects: matchedProjects.slice(0, 5).map((p) => ({
      id: p.id, name: p.name, clientName: p.clientName, type: p.type, status: p.status,
      priority: p.priority, description: p.description, aiSummary: p.aiSummary, progress: p.progress,
      createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    })),
    people: matchedPeople.slice(0, 5).map((p) => ({
      id: p.id, name: p.name, email: p.email, phone: p.phone, role: p.role,
      organization: p.organization, createdAt: p.createdAt.toISOString(),
    })),
    tasks: matchedTasks.slice(0, 5).map((t) => ({
      id: t.id, projectId: t.projectId, title: t.title, description: t.description,
      priority: t.priority, status: t.status, dueDate: t.dueDate, createdAt: t.createdAt.toISOString(),
    })),
    files: matchedFiles.slice(0, 5).map((f) => ({
      id: f.id, projectId: f.projectId, name: f.name, fileType: f.fileType,
      url: f.url, size: f.size, aiSummary: f.aiSummary, createdAt: f.createdAt.toISOString(),
    })),
    aiAnswer,
  });
});

// POST /ai/memory — save a message as memory
router.post("/memory", async (req, res) => {
  const { text, memoryType } = req.body as { text?: string; memoryType?: MemoryType };
  if (!text?.trim()) { res.status(400).json({ error: "text é obrigatório" }); return; }

  await storeMemory({
    userId: req.user.id,
    source: "chat_saved",
    text: text.trim(),
    memoryType: memoryType ?? "conversa",
    important: true,
    metadata: { savedAt: new Date().toISOString() },
  });

  res.json({ ok: true });
});

// GET /ai/memories — list user memories with optional type filter
router.get("/memories", async (req, res) => {
  const { type, limit, offset } = req.query as Record<string, string | undefined>;
  const result = await listMemories(req.user.id, {
    type: type as MemoryType | undefined,
    limit: limit ? parseInt(limit) : 50,
    offset: offset ? parseInt(offset) : 0,
  });
  res.json(result);
});

// DELETE /ai/memories/all — clear all memories for user
router.delete("/memories/all", async (req, res) => {
  const count = await clearAllMemories(req.user.id);
  res.json({ deleted: count });
});

// DELETE /ai/memories/:id — delete a single memory
router.delete("/memories/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const ok = await deleteMemory(req.user.id, id);
  if (!ok) { res.status(404).json({ error: "Memória não encontrada" }); return; }
  res.status(204).end();
});

// PATCH /ai/memories/:id — update type or important flag
router.patch("/memories/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { memoryType, important } = req.body as { memoryType?: MemoryType; important?: boolean };
  const ok = await updateMemory(req.user.id, id, { memoryType, important });
  if (!ok) { res.status(404).json({ error: "Memória não encontrada" }); return; }
  res.json({ ok: true });
});

export default router;
