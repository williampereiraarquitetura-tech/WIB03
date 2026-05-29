import { db } from "@workspace/db";
import { filesTable } from "@workspace/db/schema";
import { eq, desc, and, SQL } from "drizzle-orm";
import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  const { projectId, fileType } = req.query;
  const uid = req.user.id;

  const conditions: SQL[] = [eq(filesTable.userId, uid)];
  if (projectId) conditions.push(eq(filesTable.projectId, parseInt(projectId as string)));
  if (fileType) conditions.push(eq(filesTable.fileType, fileType as string));

  const rows = await db.select().from(filesTable)
    .where(and(...conditions))
    .orderBy(desc(filesTable.createdAt));

  res.json(rows.map((f) => ({
    id: f.id, projectId: f.projectId, name: f.name, fileType: f.fileType,
    url: f.url, size: f.size, aiSummary: f.aiSummary, createdAt: f.createdAt.toISOString(),
  })));
});

export default router;
