# WIB — Segundo Cérebro

WIB é um app mobile-first de segundo cérebro para gestão de projetos urbanísticos, aprovações municipais, GRAPROHAB, incorporações e equipes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (porta 8080, rota `/api`)
- `pnpm --filter @workspace/wib run dev` — Expo app (web preview + QR code para Expo Go)
- `pnpm run typecheck` — typecheck completo em todos os pacotes
- `pnpm --filter @workspace/api-spec run codegen` — regenerar hooks React Query e schemas Zod
- `pnpm --filter @workspace/db run push` — aplicar schema no DB (só dev)
- Env obrigatórios: `DATABASE_URL`, `OPENAI_API_KEY`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Drizzle ORM + PostgreSQL
- Mobile: Expo SDK 54 + React Native + Expo Router
- AI: OpenAI gpt-4o-mini (chat, análise de imagem) + Whisper (transcrição de áudio)
- Validation: Zod, drizzle-zod
- API client: Orval (gerado de OpenAPI spec em `lib/api-spec/`)
- Build: esbuild (bundle CJS para API server)

## Where things live

```
artifacts/api-server/src/
  routes/         — projects, people, tasks, inbox, upload, files, timeline, ai
  services/       — openaiClient, transcription, imageAnalysis, pdfReader, classification
  app.ts          — Express app + static /api/uploads/
  routes/index.ts — monta todos os routers

artifacts/wib/
  app/(tabs)/     — index (Hoje), projetos, captura, documentos, pessoas
  app/            — inbox, tarefas, assistente, projeto/[id], novo-projeto
  components/     — GlassCard, ProjectCard, TaskCard, PersonCard, InboxCard, TimelineItem, ...
  constants/colors.ts  — tema dark WIB (lime #cbf157, purple #6f00d1, bg #050505)
  hooks/useColors.ts   — sempre retorna colors.dark (app dark-only)

lib/db/src/schema/   — projects, people, tasks, files, inbox, timeline
lib/api-spec/        — OpenAPI spec (fonte de verdade do contrato API)
lib/api-client-react/ — hooks React Query gerados (useListProjects, useSendChat, etc.)
```

## Architecture decisions

- **Dark-only**: WIB não suporta light mode. `useColors()` sempre retorna `colors.dark`.
- **Upload → Inbox → Confirmação**: todo arquivo capturado vai para a Inbox com análise AI antes de ser vinculado a um projeto.
- **Roteamento AI**: o aiRouter é montado sem prefixo no routes/index.ts (rotas `/today`, `/chat`, `/search` ficam em `/api/today`, etc.)
- **Zod no backend**: importar de `"zod"` (não `"zod/v4"`) para compatibilidade com esbuild bundling.
- **Uploads locais**: arquivos salvos em `artifacts/api-server/uploads/`, servidos como estáticos em `/api/uploads/`.

## Product

- **Dashboard (Hoje)**: resumo AI do dia, tarefas urgentes, atividade recente
- **Projetos**: CRUD completo com tipos (GRAPROHAB, incorporação, loteamento, etc.), status, progresso e timeline
- **Captura**: gravar áudio → transcrição Whisper → análise IA → Inbox; foto/galeria → análise visão; PDF → extração texto → análise
- **Smart Inbox**: itens capturados com sugestões AI (projeto, tarefas, prioridade), confirmação gera tarefas
- **Documentos**: todos os arquivos processados com busca e filtro por tipo
- **Pessoas**: contatos com papéis (cliente, técnico, prefeitura, etc.)
- **Assistente WIB**: chat com contexto dos projetos, tarefas e pessoas

## User preferences

- Tema dark com lime (#cbf157) e roxo (#6f00d1) como cores de destaque
- Linguagem pt-BR em toda a interface
- App mobile-first (Expo Go + web preview)

## Gotchas

- **Sempre usar `import { z } from "zod"`** (não `"zod/v4"`) em rotas do api-server — esbuild não resolve subpath exports.
- Após instalar novos pacotes, reiniciar o workflow do Expo para o Metro resolver corretamente.
- `expo-av` está deprecated no SDK 54 (aviso apenas, ainda funciona). Migrar para `expo-audio` quando disponível.
- `expo-document-picker` versão deve ser `~14.0.8` para SDK 54.
- Upload máximo: 100MB por arquivo.
- **Cache do /api/today**: o endpoint caches o resultado por 5 minutos em memória (variável `todayCache` em `routes/ai.ts`). A primeira request demora ~1s (OpenAI), as seguintes retornam em <100ms. Invalidar o cache ao criar tarefas/projetos se necessário.

## Pointers

- Ver skill `pnpm-workspace` para estrutura do workspace, TypeScript e detalhes de pacotes
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- DB schema: `lib/db/src/schema/index.ts`
- Tema: `artifacts/wib/constants/colors.ts`
