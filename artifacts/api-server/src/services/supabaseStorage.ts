import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger.js";

const BUCKET = "wib-files";

// Use service role key for server-side storage operations (bypasses RLS)
let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY; // never fall back to anon key
    if (!url) throw new Error("SUPABASE_URL is not set");
    if (!key) throw new Error("SUPABASE_SERVICE_KEY is not set — do not use SUPABASE_ANON_KEY for server-side storage");
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/**
 * Uploads a local file to Supabase Storage.
 * Returns the storage path (used later for deletion) and the public URL.
 * The local file is NOT deleted here — caller decides based on isTemp.
 */
export async function saveFileToSupabase(
  localPath: string,
  originalName: string,
  mimeType: string,
): Promise<{ storedName: string; url: string; storagePath: string }> {
  const client = getClient();
  const ext = path.extname(originalName) || "";
  const storedName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const storagePath = `uploads/${storedName}`;

  const fileBuffer = await fs.promises.readFile(localPath);

  const { error } = await client.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  const { data: { publicUrl } } = client.storage.from(BUCKET).getPublicUrl(storagePath);

  logger.info({ storagePath, originalName }, "File uploaded to Supabase Storage");

  return { storedName, url: publicUrl, storagePath };
}

/**
 * Deletes a file from Supabase Storage using its storage path.
 */
export async function deleteFileFromSupabase(storagePath: string): Promise<void> {
  const { error } = await getClient().storage.from(BUCKET).remove([storagePath]);
  if (error) {
    logger.warn({ storagePath, err: error.message }, "Failed to delete file from Supabase Storage");
  } else {
    logger.info({ storagePath }, "File deleted from Supabase Storage");
  }
}

/**
 * Returns the public URL for a given storage path.
 */
export function getSupabasePublicUrl(storagePath: string): string {
  return getClient().storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
