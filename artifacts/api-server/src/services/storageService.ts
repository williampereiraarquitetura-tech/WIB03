import fs from "fs";
import path from "path";
import { saveFileToDrive, deleteFileFromDrive } from "./googleDriveStorage.js";
import { saveFileToSupabase, deleteFileFromSupabase, getSupabasePublicUrl } from "./supabaseStorage.js";

const PROVIDER = (process.env["STORAGE_PROVIDER"] ?? "local").toLowerCase();
// Supported values: "local" | "supabase" | "google-drive"

const UPLOAD_DIR = process.env["UPLOAD_DIR"]
  ? path.resolve(process.env["UPLOAD_DIR"])
  : path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface SaveResult {
  storedName: string;
  url: string;
  /** For supabase: the storage path (e.g. "uploads/filename.m4a").
   *  For google-drive: the Drive file ID.
   *  Stored in files.drive_file_id column for later deletion. */
  driveFileId?: string;
  isTemp: boolean;
}

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export function getFilePath(storedName: string): string {
  return path.join(UPLOAD_DIR, storedName);
}

/**
 * Returns the public URL for a stored file.
 * For supabase: generates the Supabase Storage public URL.
 * For local: returns the local API path.
 */
export function getFileUrl(storedName: string, driveFileId?: string): string {
  if (PROVIDER === "supabase" && driveFileId) {
    return getSupabasePublicUrl(driveFileId);
  }
  if (PROVIDER === "google-drive" && driveFileId) {
    return `https://drive.google.com/uc?export=download&id=${driveFileId}`;
  }
  return `/api/uploads/${storedName}`;
}

/**
 * Persists a file that multer already saved to disk.
 *
 * - supabase: uploads to Supabase Storage bucket, returns public URL (isTemp=true)
 * - google-drive: uploads to Drive, returns Drive URL (isTemp=true)
 * - local: returns info about the already-saved file (isTemp=false)
 *
 * For isTemp=true providers: the local file at localPath must remain accessible
 * until AI processing finishes (the queue worker deletes it afterwards).
 */
export async function saveFile(
  localPath: string,
  originalName: string,
  mimeType: string,
): Promise<SaveResult> {
  if (PROVIDER === "supabase") {
    const result = await saveFileToSupabase(localPath, originalName, mimeType);
    return {
      storedName: result.storedName,
      url: result.url,
      driveFileId: result.storagePath, // reuse column to store Supabase path
      isTemp: true,
    };
  }

  if (PROVIDER === "google-drive") {
    const result = await saveFileToDrive(localPath, originalName, mimeType);
    return {
      storedName: result.storedName,
      url: result.url,
      driveFileId: result.driveFileId,
      isTemp: true,
    };
  }

  // local — file is already on disk, serve it statically
  const storedName = path.basename(localPath);
  return {
    storedName,
    url: `/api/uploads/${storedName}`,
    isTemp: false,
  };
}

/**
 * Deletes a stored file.
 * Uses driveFileId to find it on Supabase or Drive.
 * Falls back to local disk deletion.
 */
export async function deleteFile(storedName: string, driveFileId?: string): Promise<void> {
  if (PROVIDER === "supabase" && driveFileId) {
    await deleteFileFromSupabase(driveFileId);
    return;
  }

  if (PROVIDER === "google-drive" && driveFileId) {
    await deleteFileFromDrive(driveFileId);
    return;
  }

  const filePath = path.join(UPLOAD_DIR, storedName);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}
