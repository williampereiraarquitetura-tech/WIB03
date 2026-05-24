import { db } from "@workspace/db";
import { filesTable, inboxItemsTable, projectsTable } from "@workspace/db/schema";
import { classificationService, imageAnalysisService, pdfReaderService, transcriptionService } from "../services/index.js";
import fs from "fs";
import path from "path";
import multer from "multer";
import { Router } from "express";
import { desc } from "drizzle-orm";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.random().toString(36).slice(2);
    const ext = path.extname(file.originalname) || "";
    cb(null, unique + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router = Router();

function getFileType(mimetype: string, originalname: string): "audio" | "image" | "pdf" | "document" {
  if (mimetype.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|webm|mpeg)$/i.test(originalname)) return "audio";
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype === "application/pdf" || originalname.toLowerCase().endsWith(".pdf")) return "pdf";
  return "document";
}

router.post("/", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Nenhum arquivo enviado" });
    return;
  }

  const fileType = getFileType(file.mimetype, file.originalname);
  const fileUrl = `/api/uploads/${file.filename}`;
  const projectId = req.body?.projectId ? parseInt(req.body.projectId) : undefined;

  let content = "";
  let rawTranscription: string | undefined;

  try {
    if (fileType === "audio") {
      rawTranscription = await transcriptionService.transcribeAudio(file.path);
      content = rawTranscription;
    } else if (fileType === "image") {
      content = await imageAnalysisService.analyzeImage(file.path);
    } else if (fileType === "pdf") {
      content = await pdfReaderService.analyzePdf(file.path);
    } else {
      content = `Arquivo recebido: ${file.originalname}`;
    }
  } catch (err) {
    req.log?.warn({ err }, "AI processing failed, continuing without AI analysis");
    content = `Arquivo recebido: ${file.originalname}`;
  }

  const projects = await db.select({ name: projectsTable.name }).from(projectsTable).orderBy(desc(projectsTable.updatedAt)).limit(20);
  const projectNames = projects.map((p) => p.name);

  let aiSuggestions = null;
  try {
    aiSuggestions = await classificationService.classifyContent(content, fileType, projectNames);
  } catch {
    req.log?.warn("Classification failed");
  }

  const title = fileType === "audio"
    ? `Áudio — ${new Date().toLocaleDateString("pt-BR")}`
    : fileType === "image"
    ? `Imagem — ${new Date().toLocaleDateString("pt-BR")}`
    : fileType === "pdf"
    ? (file.originalname || `PDF — ${new Date().toLocaleDateString("pt-BR")}`)
    : file.originalname;

  const [inboxItem] = await db.insert(inboxItemsTable).values({
    type: fileType,
    title,
    content,
    rawTranscription,
    aiSuggestions,
    status: "pending",
    fileUrl,
  }).returning();

  if (projectId) {
    await db.insert(filesTable).values({
      projectId,
      name: file.originalname,
      fileType,
      url: fileUrl,
      size: file.size,
      aiSummary: content.slice(0, 500),
    });
  }

  res.json({
    id: inboxItem!.id,
    type: inboxItem!.type,
    title: inboxItem!.title,
    content: inboxItem!.content,
    rawTranscription: inboxItem!.rawTranscription,
    aiSuggestions: inboxItem!.aiSuggestions,
    status: inboxItem!.status,
    fileUrl: inboxItem!.fileUrl,
    createdAt: inboxItem!.createdAt.toISOString(),
  });
});

export default router;
