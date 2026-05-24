import { useState } from "react";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface UploadResult {
  id: number;
  type: string;
  title: string;
  content?: string | null;
  rawTranscription?: string | null;
  aiSuggestions?: unknown;
  status: string;
  fileUrl?: string | null;
  createdAt: string;
}

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (uri: string, fileName: string, mimeType: string, projectId?: number): Promise<UploadResult | null> => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", { uri, name: fileName, type: mimeType } as any);
      if (projectId) formData.append("projectId", String(projectId));

      const resp = await fetch(`${BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        throw new Error(`Upload falhou: ${resp.status}`);
      }

      const data = await resp.json() as UploadResult;
      return data;
    } catch (e: any) {
      setError(e?.message ?? "Erro no upload");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error };
}
