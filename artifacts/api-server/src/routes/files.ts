import { db } from "@workspace/db";
import { filesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  const { projectId, fileType } = req.query;
  const rows = await db.select().from(filesTable).orderBy(desc(filesTable.createdAt));

  const filtered = rows.filter((f) => {
    if (projectId && f.projectId !== parseInt(projectId as string)) return false;
    if (fileType && f.fileType !== fileType) return false;
    return true;
  });

  res.json(
    filtered.map((f) => ({
      id: f.id,
      projectId: f.projectId,
      name: f.name,
      fileType: f.fileType,
      url: f.url,
      size: f.size,
      aiSummary: f.aiSummary,
      createdAt: f.createdAt.toISOString(),
    }))
  );
});

export default router;
