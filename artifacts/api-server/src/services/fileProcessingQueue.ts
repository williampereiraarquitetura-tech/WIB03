import fs from "fs";
import { db } from "@workspace/db";
import { filesTable, inboxItemsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { classificationService, imageAnalysisService, pdfReaderService, transcriptionService } from "./index.js";
import { storeMemoryChunks } from "./memoryService.js";
import { logger } from "../lib/logger.js";

export interface ProcessJob {
  inboxItemId: number;
  fileId: number;
  filePath: string;
  fileType: "audio" | "image" | "pdf" | "document";
  originalName: string;
  projectNames: string[];
  projectId: number | null;
  userId: number;
  /** When true, the local file is a temp copy that should be deleted after processing. */
  isTemp: boolean;
}

const queue: ProcessJob[] = [];
let processing = false;

async function processJob(job: ProcessJob): Promise<void> {
  logger.info({ inboxItemId: job.inboxItemId, fileType: job.fileType }, "Processing file");

  await db
    .update(inboxItemsTable)
    .set({ status: "processing" })
    .where(eq(inboxItemsTable.id, job.inboxItemId));

  let content = "";
  let rawTranscription: string | undefined;

  try {
    if (job.fileType === "audio") {
      rawTranscription = await transcriptionService.transcribeAudio(job.filePath);
      content = rawTranscription;
    } else if (job.fileType === "image") {
      content = await imageAnalysisService.analyzeImage(job.filePath);
    } else if (job.fileType === "pdf") {
      content = await pdfReaderService.analyzePdf(job.filePath);
    } else {
      content = `Arquivo recebido: ${job.originalName}`;
    }
  } catch (err) {
    logger.warn({ err, inboxItemId: job.inboxItemId }, "AI processing failed, using fallback content");
    content = `Arquivo recebido: ${job.originalName}`;
  }

  const classifyType = job.fileType === "document" ? "text" : job.fileType;

  let aiSuggestions = null;
  try {
    aiSuggestions = await classificationService.classifyContent(content, classifyType, job.projectNames);
  } catch (err) {
    logger.warn({ err }, "Classification failed");
  }

  await db
    .update(inboxItemsTable)
    .set({ content, rawTranscription, aiSuggestions, status: "needs_review" })
    .where(eq(inboxItemsTable.id, job.inboxItemId));

  await db
    .update(filesTable)
    .set({ aiSummary: content.slice(0, 500) })
    .where(eq(filesTable.id, job.fileId));

  // Store content as searchable vector memory chunks (non-blocking)
  if (content && content.length > 20) {
    storeMemoryChunks({
      userId: job.userId,
      source: `${job.fileType}_chunk`,
      sourceId: job.fileId,
      text: content,
      metadata: {
        fileType: job.fileType,
        originalName: job.originalName,
        projectId: job.projectId,
        inboxItemId: job.inboxItemId,
      },
    }).catch((err) => logger.warn({ err, fileId: job.fileId }, "Memory chunk storage failed"));
  }

  if (job.isTemp) {
    fs.promises.unlink(job.filePath).catch(() => {});
  }

  logger.info({ inboxItemId: job.inboxItemId }, "File processing complete");
}

async function runQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const job = queue.shift()!;
    try {
      await processJob(job);
    } catch (err) {
      logger.error({ err, inboxItemId: job.inboxItemId }, "Job failed");
      await db
        .update(inboxItemsTable)
        .set({ status: "failed" })
        .where(eq(inboxItemsTable.id, job.inboxItemId))
        .catch(() => {});
    }
  }

  processing = false;
}

export function enqueue(job: ProcessJob): void {
  queue.push(job);
  setImmediate(runQueue);
}

export function getQueueLength(): number {
  return queue.length;
}
