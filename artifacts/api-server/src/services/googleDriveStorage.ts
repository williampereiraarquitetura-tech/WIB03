import { google, drive_v3 } from "googleapis";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { logger } from "../lib/logger.js";

let _drive: drive_v3.Drive | null = null;
let _folderId: string | null = null;

function getDrive(): drive_v3.Drive {
  if (_drive) return _drive;

  const keyRaw = process.env["GOOGLE_SERVICE_ACCOUNT_KEY"];
  if (!keyRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY env var not set");

  let credentials: object;
  try {
    // Accept either the raw JSON string or a base64-encoded version
    const decoded = Buffer.from(keyRaw, "base64").toString("utf-8");
    credentials = JSON.parse(decoded.startsWith("{") ? decoded : keyRaw);
  } catch {
    credentials = JSON.parse(keyRaw);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  _drive = google.drive({ version: "v3", auth });
  return _drive;
}

function getFolderId(): string {
  if (_folderId) return _folderId;
  const id = process.env["GOOGLE_DRIVE_FOLDER_ID"];
  if (!id) throw new Error("GOOGLE_DRIVE_FOLDER_ID env var not set");
  _folderId = id;
  return id;
}

export async function saveFileToDrive(
  filePath: string,
  originalName: string,
  mimeType: string,
): Promise<{ driveFileId: string; url: string; storedName: string }> {
  const drive = getDrive();
  const folderId = getFolderId();

  const storedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${path.basename(originalName)}`;

  const fileStream = fs.createReadStream(filePath);

  const response = await drive.files.create({
    requestBody: {
      name: storedName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: fileStream,
    },
    fields: "id,name,webContentLink",
  });

  const fileId = response.data.id!;

  // Make the file publicly readable so it can be accessed via URL
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  // Direct download URL
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;

  logger.info({ fileId, storedName }, "File uploaded to Google Drive");

  return { driveFileId: fileId, url, storedName };
}

export async function deleteFileFromDrive(driveFileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId: driveFileId });
  logger.info({ driveFileId }, "File deleted from Google Drive");
}

export async function streamFileFromDrive(driveFileId: string): Promise<Readable> {
  const drive = getDrive();
  const response = await drive.files.get(
    { fileId: driveFileId, alt: "media" },
    { responseType: "stream" },
  );
  return response.data as Readable;
}
