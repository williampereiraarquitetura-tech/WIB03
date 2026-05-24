import { getOpenAIClient } from "./openaiClient.js";

export interface AISuggestions {
  contentType: string;
  suggestedProject: string;
  suggestedPeople: string[];
  priority: string;
  tasks: string[];
  tags: string[];
  summary: string;
}

export async function classifyContent(
  content: string,
  contentType: "audio" | "image" | "pdf" | "text",
  existingProjects: string[],
): Promise<AISuggestions> {
  const client = getOpenAIClient();

  const projectList = existingProjects.length > 0 ? existingProjects.join(", ") : "nenhum projeto cadastrado ainda";

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você é o WIB, um assistente de segundo cérebro para gestão de projetos urbanísticos, aprovações municipais e incorporações imobiliárias.

Analise o conteúdo fornecido e retorne um JSON com:
- contentType: tipo do conteúdo ("reunião", "documento", "pendência", "decisão", "nota", "tarefa")
- suggestedProject: nome do projeto mais relevante da lista: ${projectList}
- suggestedPeople: lista de nomes de pessoas mencionadas
- priority: prioridade sugerida ("urgente", "importante", "aguardando_terceiro", "bloqueada", "baixa")
- tasks: lista de até 3 tarefas geradas pelo conteúdo
- tags: lista de tags relevantes (máximo 5)
- summary: resumo executivo em 1-2 frases

Responda APENAS com o JSON, sem explicações.`,
      },
      {
        role: "user",
        content: `Tipo: ${contentType}\n\nConteúdo: ${content}`,
      },
    ],
    max_tokens: 600,
  });

  try {
    const text = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(text) as AISuggestions;
  } catch {
    return {
      contentType: "nota",
      suggestedProject: "",
      suggestedPeople: [],
      priority: "importante",
      tasks: [],
      tags: [],
      summary: content.slice(0, 100),
    };
  }
}
