import { useRef, useState } from "react";
import { API_URL } from "@/config/api";
import { supabase } from "@/config/supabase";

export type UploadStatus = "idle" | "sending" | "processing" | "done" | "error";

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
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);   // 0–1 during sending phase
  const [error, setError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = () => {
    setUploadStatus("idle");
    setProgress(0);
    setError(null);
    xhrRef.current = null;
  };

  const cancel = () => {
    xhrRef.current?.abort();
    reset();
  };

  const upload = (
    uri: string,
    fileName: string,
    mimeType: string,
    projectId?: number,
  ): Promise<UploadResult | null> =>
    new Promise(async (resolve) => {
      setUploadStatus("sending");
      setProgress(0);
      setError(null);

      // Get auth token
      let token: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token ?? null;
        if (!token) throw new Error("Usuário não autenticado");
      } catch (e: any) {
        setUploadStatus("error");
        setError(e?.message ?? "Não autenticado");
        resolve(null);
        return;
      }

      const formData = new FormData();
      formData.append("file", { uri, name: fileName, type: mimeType } as any);
      if (projectId) formData.append("projectId", String(projectId));

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      // Track bytes being sent (0 → 1)
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setProgress(e.loaded / e.total);
      });

      // Upload bytes done — server is now receiving and queuing AI
      xhr.upload.addEventListener("load", () => {
        setProgress(1);
        setUploadStatus("processing");
      });

      // Full HTTP response received
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as UploadResult;
            setUploadStatus("done");
            resolve(data);
          } catch {
            setUploadStatus("error");
            setError("Resposta inválida do servidor");
            resolve(null);
          }
        } else {
          setUploadStatus("error");
          setError(`Servidor retornou ${xhr.status}. Tente novamente.`);
          resolve(null);
        }
      });

      xhr.addEventListener("error", () => {
        setUploadStatus("error");
        setError("Erro de rede. Verifique sua conexão.");
        resolve(null);
      });

      // Abort triggered by cancel()
      xhr.addEventListener("abort", () => resolve(null));

      xhr.open("POST", `${API_URL}/api/upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    });

  return { upload, uploadStatus, progress, error, cancel, reset };
}
