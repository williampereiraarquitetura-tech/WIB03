import fs from "fs";
import path from "path";
import { saveFileToDrive, deleteFileFromDrive } from "./googleDriveStorage.js";

const PROVIDER = (process.env["STORAGE_PROVIDER"] ?? "local").toLowerCase();

const UPLOAD_DIR = process.env["UPLOAD_DIR"]
  ? path.resolve(process.env["UPLOAD_DIR"])
  : path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface SaveResult {
  storedName: string;
  url: string;
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
 * Persists a file that multer already saved to disk.
 * For local: returns info about the already-saved file (isTemp=false).
 * For google-drive: uploads to Drive, returns Drive URL (isTemp=true — caller must keep localPath until AI processing finishes).
 */
export async function saveFile(
  localPath: string,
  originalName: string,
  mimeType: string,
): Promise<SaveResult> {
  if (PROVIDER === "google-drive") {
    const result = await saveFileToDrive(localPath, originalName, mimeType);
    return {
      storedName: result.storedName,
      url: result.url,
      driveFileId: result.driveFileId,
      isTemp: true,
    };
  }

  const storedName = path.basename(localPath);
  return {
    storedName,
    url: `/api/uploads/${storedName}`,
    isTemp: false,
  };
}

export async function deleteFile(storedName: string, driveFileId?: string): Promise<void> {
  if (PROVIDER === "google-drive" && driveFileId) {
    await deleteFileFromDrive(driveFileId);
    return;
  }
  const filePath = path.join(UPLOAD_DIR, storedName);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}
