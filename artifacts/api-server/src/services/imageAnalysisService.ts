import fs from "fs";
import path from "path";
import { getOpenAIClient } from "./openaiClient.js";

export async function analyzeImage(filePath: string): Promise<string> {
  const client = getOpenAIClient();
  const imageData = fs.readFileSync(filePath);
  const base64 = imageData.toString("base64");
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
          {
            type: "text",
            text: "Você é um assistente especializado em projetos urbanísticos e aprovações municipais. Analise esta imagem e descreva: o que é mostrado, informações relevantes extraídas (textos, datas, nomes, protocolos, pendências), e qual ação pode ser necessária. Responda em português de forma objetiva e estruturada.",
          },
        ],
      },
    ],
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content ?? "Não foi possível analisar a imagem.";
}
