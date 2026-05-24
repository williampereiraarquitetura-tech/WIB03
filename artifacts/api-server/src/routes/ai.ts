import { db } from "@workspace/db";
import { inboxItemsTable, projectsTable, tasksTable, timelineEventsTable, filesTable, peopleTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { Router } from "express";
import { getOpenAIClient } from "../services/openaiClient.js";

const router = Router();

interface TodayCache {
  data: object;
  expiresAt: number;
}
let todayCache: TodayCache | null = null;
const TODAY_CACHE_TTL_MS = 5 * 60 * 1000;

router.get("/today", async (req, res) => {
  if (todayCache && Date.now() < todayCache.expiresAt) {
    res.json(todayCache.data);
    return;
  }
  const [urgentTasks, pendingInboxCount, recentEvents, blockedProjects] = await Promise.all([
    db.select({ task: tasksTable, projectName: projectsTable.name })
      .from(tasksTable)
      .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(eq(tasksTable.status, "pendente"))
      .orderBy(desc(tasksTable.createdAt))
      .limit(5),
    db.select().from(inboxItemsTable).where(eq(inboxItemsTable.status, "pending")),
    db.select({ event: timelineEventsTable, projectName: projectsTable.name })
      .from(timelineEventsTable)
      .leftJoin(projectsTable, eq(timelineEventsTable.projectId, projectsTable.id))
      .orderBy(desc(timelineEventsTable.createdAt))
      .limit(5),
    db.select().from(projectsTable).where(eq(projectsTable.status, "bloqueado")),
  ]);

  const urgentOnly = urgentTasks
    .filter(({ task }) => ["urgente", "importante"].includes(task.priority))
    .slice(0, 5);

  let aiSummary = "";
  try {
    const client = getOpenAIClient();
    const context = `
Projetos bloqueados: ${blockedProjects.length}
Itens pendentes na inbox: ${pendingInboxCount.length}
Tarefas urgentes: ${urgentOnly.map(({ task }) => task.title).join(", ") || "nenhuma"}
    `.trim();

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é o WIB. Crie um resumo executivo do dia em 1-2 frases objetivas baseado no contexto.",
        },
        { role: "user", content: context },
      ],
      max_tokens: 150,
    });
    aiSummary = resp.choices[0]?.message?.content ?? "";
  } catch {
    aiSummary = "Confira suas prioridades e inbox abaixo.";
  }

  const payload = {
    aiSummary,
    urgentTasks: urgentOnly.map(({ task, projectName }) => ({
      id: task.id,
      projectId: task.projectId,
      projectName: projectName ?? undefined,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      createdAt: task.createdAt.toISOString(),
    })),
    blockedProjects: blockedProjects.length,
    pendingInbox: pendingInboxCount.length,
    recentEvents: recentEvents.map(({ event, projectName }) => ({
      id: event.id,
      projectId: event.projectId,
      projectName: projectName ?? undefined,
      type: event.type,
      title: event.title,
      description: event.description,
      createdAt: event.createdAt.toISOString(),
    })),
  };

  todayCache = { data: payload, expiresAt: Date.now() + TODAY_CACHE_TTL_MS };
  res.json(payload);
});

router.post("/chat", async (req, res) => {
  const { message, history = [] } = req.body as { message: string; history?: { role: string; content: string }[] };

  if (!message) {
    res.status(400).json({ error: "Mensagem é obrigatória" });
    return;
  }

  const [projects, tasks, people] = await Promise.all([
    db.select().from(projectsTable).orderBy(desc(projectsTable.updatedAt)).limit(10),
    db.select().from(tasksTable).where(eq(tasksTable.status, "pendente")).limit(10),
    db.select().from(peopleTable).limit(10),
  ]);

  const context = `
PROJETOS: ${projects.map((p) => `${p.name} (${p.status})`).join(", ") || "nenhum"}
TAREFAS PENDENTES: ${tasks.map((t) => `${t.title} [${t.priority}]`).join(", ") || "nenhuma"}
PESSOAS: ${people.map((p) => `${p.name} (${p.role})`).join(", ") || "nenhuma"}
  `.trim();

  let aiResponse = "";
  let suggestedActions: string[] = [];

  try {
    const client = getOpenAIClient();
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      {
        role: "system",
        content: `Você é o WIB, um assistente de segundo cérebro especializado em projetos urbanísticos, aprovações municipais e incorporações imobiliárias. Responda em português de forma objetiva e útil.

CONTEXTO ATUAL:
${context}`,
      },
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: message },
    ];

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 800,
    });
    aiResponse = resp.choices[0]?.message?.content ?? "Não foi possível processar sua pergunta.";

    if (projects.length === 0) {
      suggestedActions.push("Cadastrar primeiro projeto");
    }
    if (tasks.length > 3) {
      suggestedActions.push("Ver tarefas urgentes");
    }
  } catch (err) {
    aiResponse = "Desculpe, não foi possível processar sua pergunta no momento. Verifique a configuração da chave OpenAI.";
  }

  res.json({ message: aiResponse, suggestedActions });
});

router.get("/search", async (req, res) => {
  const { q } = req.query as { q: string };
  if (!q) {
    res.status(400).json({ error: "Parâmetro 'q' é obrigatório" });
    return;
  }

  const search = q.toLowerCase();

  const [allProjects, allPeople, allTasks, allFiles] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(peopleTable),
    db.select().from(tasksTable),
    db.select().from(filesTable),
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
          {
            role: "system",
            content: "Você é o WIB. Com base nos resultados encontrados, responda a pergunta do usuário de forma objetiva.",
          },
          { role: "user", content: `Pergunta: "${q}"\n\nResultados: ${context}` },
        ],
        max_tokens: 300,
      });
      aiAnswer = resp.choices[0]?.message?.content ?? "";
    }
  } catch {
    //
  }

  res.json({
    projects: matchedProjects.slice(0, 5).map((p) => ({
      id: p.id, name: p.name, clientName: p.clientName, type: p.type, status: p.status, priority: p.priority,
      description: p.description, aiSummary: p.aiSummary, progress: p.progress,
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

export default router;
