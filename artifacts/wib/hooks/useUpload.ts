import { useState } from "react";
import { API_URL } from "@/config/api";
import { supabase } from "@/config/supabase";

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Usuário não autenticado");

      const formData = new FormData();
      formData.append("file", { uri, name: fileName, type: mimeType } as any);
      if (projectId) formData.append("projectId", String(projectId));

      const resp = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!resp.ok) throw new Error(`Upload falhou: ${resp.status}`);
      return await resp.json() as UploadResult;
    } catch (e: any) {
      setError(e?.message ?? "Erro no upload");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error };
}
