import fs from "fs";
import { getOpenAIClient } from "./openaiClient.js";

async function extractTextFromPdf(filePath: string): Promise<string> {
  try {
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  } catch {
    return "[Não foi possível extrair texto do PDF]";
  }
}

export async function analyzePdf(filePath: string): Promise<string> {
  const client = getOpenAIClient();
  const text = await extractTextFromPdf(filePath);
  const truncated = text.slice(0, 6000);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Você é um assistente especializado em projetos urbanísticos, aprovações municipais e documentação técnica. Analise o texto extraído de um PDF e identifique: tipo de documento, entidades envolvidas (pessoas, órgãos, protocolos), datas importantes, pendências ou exigências, ações necessárias e resumo executivo.",
      },
      {
        role: "user",
        content: `Analise este documento:\n\n${truncated}`,
      },
    ],
    max_tokens: 1200,
  });

  return response.choices[0]?.message?.content ?? "Não foi possível analisar o PDF.";
}
