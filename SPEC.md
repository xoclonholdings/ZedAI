# ZED AI Specification

## Purpose

ZED AI is a local-first multi-agent AI application built around an Express backend and a React/Vite frontend. The system supports chat, conversation history, file upload, admin controls, and orchestrated agent workflows backed by Ollama and optional external services.

This file is the canonical project spec for the repository. If the project changes, update this document instead of spreading source-of-truth details across multiple Markdown files.

## Canonical Rules

- `SPEC.md` is the primary project specification.
- `README.md` is only a short entrypoint that points here.
- Long-term branch policy is:
  - `main`
  - `backup`
- Local AI model artifacts such as `models/` are not part of the repo and must remain ignored.

## Repository Layout

```text
ZedAI/
  client/           React + Vite frontend
  server/           Express + TypeScript backend
  shared/           Shared schemas and cross-app types/config
  hub/              Root shared-memory/config area
  zed-docs/         Legacy documentation archive
  zed-memory/       Project memory/data area
  zed-backend/      Legacy backend area
  attached_assets/  Static attached image assets
  netlify.toml      Netlify deploy configuration
  SPEC.md           Canonical project spec
  README.md         Short entrypoint doc
```

## Runtime Architecture

### Frontend

- Stack:
  - React 18
  - Vite
  - TypeScript
  - Tailwind CSS
  - Radix UI
  - TanStack Query
  - Wouter
- Source root: `client/src`
- Main pages currently present:
  - `chat.tsx`
  - `login.tsx`
  - `admin.tsx`
  - `not-found.tsx`

### Backend

- Stack:
  - Express
  - TypeScript
  - `tsx`
  - Vite middleware in development
- Entry point: `server/index.ts`
- Main route file: `server/routes.ts`
- Dev server script:
  - `server/package.json` -> `npm run dev`
- Default local port:
  - `5000`

### Shared Layer

- Shared code lives in `shared/`
- Used for:
  - schemas
  - auth config
  - shared types/config consumed by client and server

## Core Functional Areas

### Chat and Conversations

- Conversation CRUD is handled under `/api/conversations`
- Message retrieval and posting is handled under `/api/conversations/:id/messages`
- File listing and upload is handled under:
  - `/api/conversations/:id/files`
  - `/api/conversations/:id/upload`
- Legacy direct chat endpoint still exists at `/api/chat`

### Orchestration

- Multi-agent orchestration endpoint:
  - `POST /api/orchestrate`
- Orchestrator status endpoint:
  - `GET /api/orchestrate/status`
- Manager agent routes work to specialist agents in `server/agents/`

### Admin

- Admin endpoints currently include:
  - `GET /api/admin/system-status`
  - `GET/POST /api/admin/ruleset`
  - `GET /api/admin/logs`
  - `GET /api/admin/approval-queue`
  - `POST /api/admin/approve/:id`
  - `POST /api/admin/reject/:id`
  - `GET /api/admin/security-log`
  - `GET /api/admin/system-test`

### Auth

- Session-based local auth is implemented in `server/localAuth.ts`
- Session data uses server-side persistence via file-backed session storage

## Data and Service Dependencies

### Local/Primary Dependencies

- Ollama for local model inference
- Filesystem-backed fallback storage
- Hub/shared-memory content used by agents

### Optional or Secondary Dependencies

- Neon PostgreSQL via `@neondatabase/serverless`
- ChromaDB
- Brave or Serper-style web search integrations where configured

## Current API Surface

The server currently exposes at least these API routes:

- `GET /api/me`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id`
- `DELETE /api/conversations/:id`
- `DELETE /api/conversations`
- `GET /api/conversations/:id/messages`
- `POST /api/conversations/:id/messages`
- `GET /api/conversations/:id/files`
- `POST /api/conversations/:id/upload`
- `POST /api/orchestrate`
- `GET /api/orchestrate/status`
- `POST /api/voice/transcribe`
- `GET /api/admin/system-status`
- `GET /api/admin/ruleset`
- `POST /api/admin/ruleset`
- `GET /api/admin/logs`
- `GET /api/admin/approval-queue`
- `POST /api/admin/approve/:id`
- `POST /api/admin/reject/:id`
- `GET /api/admin/security-log`
- `GET /api/admin/system-test`
- `POST /api/chat`

## Local Development

### Start Backend + Frontend Together

The backend serves the frontend through Vite middleware in development.

Run:

```powershell
cd server
npm run dev
```

App URL:

- `http://localhost:5000`

### Frontend-Only Build

Run:

```powershell
cd client
npm run build
```

The client build currently succeeds with:

- `tsc -p tsconfig.build.json && vite build`

## Deploy Specification

### Netlify

Netlify deploys the frontend from `client/`.

Canonical config is in `netlify.toml`:

```toml
[build]
  base = "client"
  command = "npm install && npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Deployment Notes

- The current Netlify config is for the client app, not the old `zed-backend/netlify-functions` layout described in legacy docs.
- Client TypeScript path alias resolution depends on `client/tsconfig.build.json`.
- Vite aliases are defined in `client/vite.config.ts`.

## Configuration Sources

### Root

- `netlify.toml`
- `.replit`
- `package.json`
- `tsconfig.json`

### Server

- `server/package.json`
- `server/index.ts`
- `server/routes.ts`
- `server/vite.ts`
- `server/db.ts`
- `server/migrations.ts`

### Client

- `client/package.json`
- `client/tsconfig.json`
- `client/tsconfig.build.json`
- `client/vite.config.ts`

## Replit Behavior

The current `.replit` workflow starts:

```text
cd server && npm run dev
```

and expects:

- local port `5000`
- external port `80`

## Documentation Policy

### Active Docs

- `SPEC.md`
- `README.md`

### Legacy Docs

The following locations are legacy reference material and should not be treated as canonical without verification:

- `zed-docs/`
- `replit.md`
- `Agentic_Guide.md`
- `Agentic_Guide_Add_On.md`
- `SKILL.md`
- agent-specific skill markdown under `server/agents/**`

If one of those files conflicts with this spec or the code, the code and `SPEC.md` win.

## Maintenance Checklist

When the project changes, update `SPEC.md` for any of the following:

- repo structure
- startup commands
- deploy configuration
- branch policy
- API routes
- auth model
- storage model
- agent layout
- environment requirements

## Known Historical Notes

- The repo previously contained tracked local model artifacts under `models/`
- Those model artifacts were removed from current reachable history and should not be added again
- The repository was normalized to keep only `main` and `backup`
