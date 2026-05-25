# WIB — Urban Nexus · Segundo Cérebro Profissional

WIB é um app mobile-first que funciona como segundo cérebro para profissionais urbanos. Captura áudios, imagens e PDFs, analisa com OpenAI e organiza tudo em projetos, tarefas, documentos e timeline.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Expo 54 + React Native + Expo Router |
| Backend | Node.js 24 + Express 5 + TypeScript |
| Banco | PostgreSQL + Drizzle ORM |
| IA | OpenAI (GPT-4o-mini + Whisper) |
| Gerenciador de pacotes | pnpm (workspace monorepo) |

---

## Pré-requisitos

- Node.js 20+ (recomendado: 24)
- pnpm 9+
- PostgreSQL 15+ rodando localmente
- Chave de API da OpenAI

```bash
npm install -g pnpm
```

---

## Configuração inicial

### 1. Copiar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` e preencha:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/wib
OPENAI_API_KEY=sk-...
EXPO_PUBLIC_API_URL=http://localhost:3000
```

> **Segurança**: `OPENAI_API_KEY` deve existir **apenas** no backend (`.env` na raiz ou em `artifacts/api-server/`). Nunca exponha no frontend.

### 2. Instalar dependências

```bash
pnpm install
```

### 3. Criar o banco de dados

```bash
# Crie o banco no PostgreSQL
psql -U postgres -c "CREATE DATABASE wib;"

# Rodar migrations
cd artifacts/api-server
pnpm run db:migrate
```

> O comando `db:migrate` usa `drizzle-kit push` para sincronizar o schema com o banco.

---

## Rodando localmente no VS Code

### Backend (porta 3000)

```bash
cd artifacts/api-server
cp ../../.env .env        # ou edite .env diretamente aqui
pnpm run build
pnpm run start
```

Para desenvolvimento com rebuild automático:

```bash
pnpm run dev
```

O servidor expõe:
- `GET  /api/healthz` — health check
- `POST /api/upload` — upload de arquivo (áudio, imagem, PDF)
- `GET  /api/inbox` — itens da inbox
- `GET  /api/projects` — projetos
- `GET  /api/tasks` — tarefas
- `GET  /api/today` — resumo do dia (IA)
- `POST /api/chat` — assistente WIB

### Frontend (Expo)

```bash
cd artifacts/wib
```

**Web (browser):**
```bash
pnpm run web
```

**Android (emulador ou dispositivo físico via Expo Go):**
```bash
pnpm run android
```

**iOS (macOS apenas):**
```bash
pnpm run ios
```

**Expo Dev Server genérico:**
```bash
pnpm run start
```

> Certifique-se de que `EXPO_PUBLIC_API_URL` no `.env` aponta para o endereço acessível pelo dispositivo/emulador. Em dispositivo físico na mesma rede, use o IP da máquina, ex: `http://192.168.1.x:3000`.

---

## Testando o upload

```bash
# Áudio
curl -F "file=@gravacao.m4a" http://localhost:3000/api/upload

# Imagem
curl -F "file=@foto.jpg" http://localhost:3000/api/upload

# PDF vinculado a um projeto
curl -F "file=@documento.pdf" -F "projectId=1" http://localhost:3000/api/upload
```

O upload retorna imediatamente com `status: "pending_processing"`. O processamento de IA roda em background e atualiza o item para `needs_review` quando concluído.

### Status do ciclo de vida de um item da Inbox

| Status | Significado |
|--------|-------------|
| `pending_processing` | Arquivo salvo, IA ainda não processou |
| `processing` | IA está analisando o arquivo |
| `needs_review` | IA concluiu, aguardando ação do usuário |
| `confirmed` | Usuário confirmou / criou tarefas |
| `dismissed` | Usuário descartou |
| `failed` | Processamento de IA falhou |

---

## Estrutura do monorepo

```
WIB03/
├── artifacts/
│   ├── api-server/        # Backend Express
│   │   ├── src/
│   │   │   ├── routes/    # Endpoints da API
│   │   │   ├── services/  # OpenAI, storage, fila de processamento
│   │   │   └── lib/       # Logger
│   │   └── uploads/       # Arquivos enviados (criado automaticamente)
│   └── wib/               # App Expo (frontend)
│       ├── app/           # Telas (Expo Router)
│       ├── components/    # Componentes reutilizáveis
│       ├── config/        # api.ts — URL central da API
│       └── hooks/         # useUpload, useColors
├── lib/
│   ├── db/                # Schema Drizzle + migrações
│   ├── api-spec/          # OpenAPI 3.1 (fonte da verdade)
│   └── api-client-react/  # Hooks React Query gerados
└── .env.example
```

---

## Scripts disponíveis

### Backend (`artifacts/api-server`)

| Comando | O que faz |
|---------|-----------|
| `pnpm run dev` | Build + inicia servidor com .env |
| `pnpm run build` | Compila TypeScript com esbuild |
| `pnpm run start` | Inicia servidor compilado |
| `pnpm run db:migrate` | Sincroniza schema com o banco |
| `pnpm run typecheck` | Verifica tipos TypeScript |

### Frontend (`artifacts/wib`)

| Comando | O que faz |
|---------|-----------|
| `pnpm run start` | Expo Dev Server |
| `pnpm run web` | Abre no browser |
| `pnpm run android` | Abre no Android |
| `pnpm run ios` | Abre no iOS |
| `pnpm run typecheck` | Verifica tipos TypeScript |

---

## Formatos de arquivo suportados

| Tipo | Extensões |
|------|-----------|
| Áudio | `.m4a`, `.mp3`, `.wav`, `.ogg`, `.webm`, `.mpeg`, `.m4a.mpeg` |
| Imagem | `.jpg`, `.jpeg`, `.png`, `.webp` |
| PDF | `.pdf` |
| Documento | qualquer outro |

Tamanho máximo: **100 MB** por arquivo.

---

## Migração para produção

1. Configure um banco PostgreSQL em produção e atualize `DATABASE_URL`
2. Mude `STORAGE_PROVIDER` para `s3`, `r2` ou `supabase` (implemente o adaptador em `storageService.ts`)
3. Defina `EXPO_PUBLIC_API_URL` com a URL pública do backend
4. Para fila de processamento em escala: substitua o worker em memória por BullMQ + Redis
5. Use um reverse proxy (nginx / Caddy) na frente do Express

---

## Variáveis de ambiente

| Variável | Onde | Descrição |
|----------|------|-----------|
| `PORT` | Backend | Porta do servidor (padrão: 3000) |
| `DATABASE_URL` | Backend | Connection string PostgreSQL |
| `OPENAI_API_KEY` | Backend | Chave da API OpenAI (nunca no frontend) |
| `STORAGE_PROVIDER` | Backend | `local` (padrão), `s3`, `r2`, `supabase` |
| `UPLOAD_DIR` | Backend | Diretório de uploads (padrão: `uploads/`) |
| `EXPO_PUBLIC_API_URL` | Frontend | URL base do backend acessível pelo app |
