import { db } from "@workspace/db";
import { projectsTable, timelineEventsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  const { projectId, limit } = req.query;
  const lim = limit ? parseInt(limit as string) : 30;
  const uid = req.user.id;

  const rows = await db
    .select({ event: timelineEventsTable, projectName: projectsTable.name })
    .from(timelineEventsTable)
    .leftJoin(projectsTable, eq(timelineEventsTable.projectId, projectsTable.id))
    .where(eq(projectsTable.userId, uid))
    .orderBy(desc(timelineEventsTable.createdAt))
    .limit(lim);

  const filtered = projectId
    ? rows.filter(({ event }) => event.projectId === parseInt(projectId as string))
    : rows;

  res.json(filtered.map(({ event, projectName }) => ({
    id: event.id, projectId: event.projectId, projectName: projectName ?? undefined,
    type: event.type, title: event.title, description: event.description,
    createdAt: event.createdAt.toISOString(),
  })));
});

export default router;
