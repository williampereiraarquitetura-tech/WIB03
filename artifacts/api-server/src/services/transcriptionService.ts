import fs from "fs";
import { getOpenAIClient } from "./openaiClient.js";

export async function transcribeAudio(filePath: string): Promise<string> {
  const client = getOpenAIClient();
  const fileStream = fs.createReadStream(filePath);

  const transcription = await client.audio.transcriptions.create({
    file: fileStream,
    model: "whisper-1",
    language: "pt",
    response_format: "text",
  });

  return transcription as unknown as string;
}
