import { db } from "@workspace/db";
import { filesTable, inboxItemsTable, projectsTable, timelineEventsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import path from "path";
import multer from "multer";
import { Router } from "express";
import { getUploadDir, saveFile } from "../services/storageService.js";
import { enqueue } from "../services/fileProcessingQueue.js";

const UPLOADS_DIR = getUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname) || "";
    cb(null, unique + ext);
  },
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

const router = Router();

function isAudioFile(mimeType: string, originalName: string): boolean {
  if (mimeType.startsWith("audio/")) return true;
  if (/\.(m4a|mp3|wav|ogg|webm|mpeg)(\.mpeg)?$/i.test(originalName)) return true;
  if (mimeType === "video/mp4" && /\.m4a/i.test(originalName)) return true;
  return false;
}

function getFileType(mimeType: string, originalName: string): "audio" | "image" | "pdf" | "document" {
  if (isAudioFile(mimeType, originalName)) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || /\.pdf$/i.test(originalName)) return "pdf";
  return "document";
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\.\./g, ".").slice(0, 255);
}

router.post("/", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "Nenhum arquivo enviado" }); return; }

  const uid = req.user.id;
  const fileType = getFileType(file.mimetype, file.originalname);
  const projectIdRaw = req.body?.projectId ? parseInt(req.body.projectId) : null;
  const projectId = projectIdRaw && !isNaN(projectIdRaw) ? projectIdRaw : null;
  const safeOriginalName = sanitizeFilename(file.originalname);

  const { storedName, url: fileUrl, driveFileId, isTemp } = await saveFile(
    file.path, safeOriginalName, file.mimetype,
  );

  const title =
    fileType === "audio" ? `Áudio — ${new Date().toLocaleDateString("pt-BR")}`
    : fileType === "image" ? `Imagem — ${new Date().toLocaleDateString("pt-BR")}`
    : safeOriginalName;

  const [fileRecord] = await db.insert(filesTable).values({
    userId: uid, projectId, name: safeOriginalName, fileType,
    url: fileUrl, driveFileId: driveFileId ?? null, size: file.size,
  }).returning();

  const [inboxItem] = await db.insert(inboxItemsTable).values({
    userId: uid, type: fileType, title, content: null, rawTranscription: null,
    aiSuggestions: null, status: "pending_processing", fileUrl,
  }).returning();

  if (projectId) {
    await db.insert(timelineEventsTable).values({
      projectId, type: "arquivo_enviado",
      title: `Arquivo enviado: ${safeOriginalName}`,
      description: `${fileType === "audio" ? "Áudio" : fileType === "image" ? "Imagem" : fileType === "pdf" ? "PDF" : "Arquivo"} enviado para processamento`,
    });
  }

  const projects = await db
    .select({ name: projectsTable.name })
    .from(projectsTable)
    .where(eq(projectsTable.userId, uid))
    .orderBy(desc(projectsTable.updatedAt))
    .limit(20);

  enqueue({
    inboxItemId: inboxItem!.id, fileId: fileRecord!.id, filePath: file.path,
    fileType, originalName: safeOriginalName, projectNames: projects.map((p) => p.name),
    projectId, isTemp,
  });

  res.json({
    id: inboxItem!.id, type: inboxItem!.type, title: inboxItem!.title,
    content: null, rawTranscription: null, aiSuggestions: null,
    status: inboxItem!.status, fileUrl: inboxItem!.fileUrl,
    fileId: fileRecord!.id, createdAt: inboxItem!.createdAt.toISOString(),
  });
});

export default router;
