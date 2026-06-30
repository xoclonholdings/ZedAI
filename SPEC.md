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
- Repo-root files should stay limited to source folders, canonical docs, and required project config.

## Repository Layout

```text
ZedAI/
  attached_assets/  Static attached image assets
  client/           React + Vite frontend
  docs/             Policies and legacy reference docs
  hub/              Root shared-memory/config area
  scripts/local/    Local Windows workstation/model-host launchers
  server/           Express + TypeScript backend
  shared/           Shared schemas and cross-app types/config
  zed-docs/         Legacy documentation archive
  zed-memory/       Legacy raw ChatGPT export backup
  netlify.toml      Netlify deploy configuration
  package.json      Root package metadata
  package-lock.json Root dependency lockfile
  tsconfig.json     Root TypeScript config
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
- Local production boot scripts:
  - `scripts/local/zed-start.ps1`
  - `scripts/local/zed-start-dev.ps1`
  - `scripts/local/zed-stop.ps1`
  - `scripts/local/start-zed-now.cmd`
  - `scripts/local/install-zed-autostart.ps1`
  - `scripts/local/install-zed-autostart.cmd`
  - `scripts/local/install-zed-workstation.cmd`
  - `scripts/local/install-zed-model-host.ps1`
  - `scripts/local/install-zed-model-host.cmd`
  - `scripts/local/zed-ollama-host.ps1`
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
- Current active agents:
  - `OperationsAgent`
  - `IntelligenceAgent` (`R&D Agent` in the UI)
- `BusinessManagerAgent` is reachable in the current live orchestrator and may operate as an active lane when Business Operations is enabled in Admin settings
- `FinanceAgent` is a live specialist lane for trading, crypto/web3, forex, and wealth-building analysis
- `FinanceAgent` is intended as a distinct lane from `BusinessManagerAgent`, focusing on predictive analysis, market opportunity, accumulation strategy, and trading/wealth contexts while sharing research blackboard data with the R&D/Intelligence lane
- Current planned agents:
  - `IDEOperatorAgent`
  - `AudioEngineerAgent`
  - future expanded `BusinessManagerAgent` capability layers, including planned Gusto integration
- Agent-mode UI supports explicit targeting for:
  - `Auto`
  - `Operations`
  - `R&D`
  - `Business`
- Agents coordinate indirectly through shared hub memory, rules, approvals, and logs rather than direct agent-to-agent chat handoff

### Admin

- Admin endpoints currently include:
  - `GET /api/admin/system-status`
  - `GET /api/admin/settings`
  - `PUT /api/admin/settings/app`
  - `PUT /api/admin/settings/personalization`
  - `PUT /api/admin/settings/integrations`
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `PATCH /api/admin/users/:id`
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
- Admin/user settings are persisted in `hub/config/admin-settings.json` locally and are not part of source control
- The app currently supports one admin account plus admin-managed local users

## Data and Service Dependencies

### Local/Primary Dependencies

- Provider-agnostic model execution routed through backend adapters
- Ollama for local-first model inference
- Optional OpenAI, Claude, and temporary remote runner adapters through shared execution contracts
- Filesystem-backed fallback storage
- Hub/shared-memory content used by agents

## Memory Model

- Live runtime memory is rooted at `hub/shared-memory/`
- Current active memory areas include:
  - `working/`
  - `episodic/`
  - `consensus/`
  - `semantic/`
- Legacy ChatGPT exports were reconciled into the canonical foundation under:
  - `hub/shared-memory/semantic/foundation/`
  - `hub/shared-memory/episodic/imported/`
  - `hub/shared-memory/consensus/foundation/`
- Lightweight lookup files now exist for normal reasoning:
  - `hub/shared-memory/semantic/foundation/conversation-index.json`
  - `hub/shared-memory/semantic/foundation/recent-conversations.json`
  - `hub/shared-memory/semantic/foundation/shards/`
- Full normalized cold storage remains at:
  - `hub/shared-memory/semantic/foundation/merged-conversations.json`
- `zed-memory/` is retained as a read-only raw backup archive and is not the active runtime memory source
- The backup/archive role of `zed-memory/` is documented in `zed-memory/LEGACY_BACKUP_MANIFEST.md`

### Knowledge Curation and Evolution Engine

The Knowledge Curation and Evolution Engine is the third planned memory system after the Knowledge Ingestion Engine and Context Engine. Its role is to act on what the first two systems learned by continuously maintaining knowledge quality, organization, accuracy, and long-term evolution.

Knowledge is treated as a living system. New information must strengthen, refine, replace, extend, or question existing knowledge instead of simply accumulating as disconnected documents.

The engine is responsible for monitoring the knowledge graph for:

- duplicate objects
- weak relationships
- contradictions
- outdated information
- incomplete objects
- orphaned knowledge
- missing context
- missing evidence
- missing decisions
- low-confidence facts
- redundant concepts
- unorganized collections

Every knowledge object must receive a dynamic health score based on completeness, confidence, context depth, relationship density, source diversity, freshness, conflict count, verification status, and user confirmation. Low-health objects become candidates for refinement.

When new information arrives, the engine compares it against existing objects and classifies the effect as confirmation, expansion, contradiction, supersession, merge, or replacement. It should not create duplicate knowledge when an existing canonical object can be refined.

Every concept should have one canonical object. Non-canonical material should be represented as an alias, historical version, rejected proposal, archived draft, or supporting evidence. The canonical object represents ZED's current understanding.

Knowledge should evolve rather than disappear. Version history must preserve original state, updated state, reason for change, user clarification, supporting evidence, timestamp, confidence before, and confidence after.

The engine continuously strengthens relationships across projects, research, agents, workflows, goals, tasks, people, companies, frameworks, books, ideas, specifications, and learning paths. It should also generate automatic living collections from the graph.

Knowledge aging must mark objects as recently updated, stable, needs review, potentially outdated, or historical. Older information must not be assumed correct without freshness and verification checks.

The engine should actively identify learning gaps and generate recommended clarification questions, such as missing objectives, owners, rationales, specifications, evidence, or decision records.

Cross-domain discovery is expected. Concepts from one domain, such as trading, business planning, behavioral insight, product design, or research, may become useful evidence or strategy in another domain.

Major canonical promotions, replacements, merges, and conflict resolutions should use a user confirmation loop when the change affects long-term knowledge authority.

The detailed operating policy is `docs/policies/KNOWLEDGE_CURATION_ENGINE.md`.

### Optional or Secondary Dependencies

- Neon PostgreSQL via `@neondatabase/serverless`
- ChromaDB
- Brave or Serper-style web search integrations where configured
- Planned Kalshi integration for event-market research and contract monitoring

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

For Windows local production boot, the server now serves the built frontend from:

- `client/dist` first
- fallback: `dist/public`

Local workstation boot is designed to be single-process in production:

- `scripts/local/zed-start.ps1` builds the client when needed
- then starts the backend in non-development mode
- the backend serves the built frontend directly

Optional separate model-host boot on a dedicated machine uses:

- `scripts/local/install-zed-model-host.ps1`
- `scripts/local/zed-ollama-host.ps1`

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
- Client-side `@shared/*` aliases resolve to `client/src/shared/*` so the Netlify client build does not depend on backend-only schema packages.
- Vite aliases are defined in `client/vite.config.ts`.

## Research and Market Analysis

- The `R&D Agent` is the current research lane and is backed by `IntelligenceAgent`
- It supports:
  - general research synthesis
  - stock and crypto analysis prompts
  - prediction-style reasoning prompts
  - expansive keyword search fanout before synthesis
- Expansive keyword search broadens market prompts into related terms such as:
  - catalysts
  - risks
  - probabilities
  - sentiment
  - event contracts
- Kalshi support is currently planned and configurable in Admin > Integrations, but not yet active for live contract execution or trading workflows

## Configuration Sources

### Root

- `netlify.toml`
- `package.json`
- `package-lock.json`
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

## Runtime Behavior

The backend is started with:

```text
cd server && npm run dev
```

and expects:

- local port `5000`
- all hub/config/log/session paths to resolve against the repo-root `hub/` directory

The backend is deployed to Render; configuration lives in the Render dashboard
(environment variables, build/start command, optional persistent disk).

## Documentation Policy

### Active Docs

- `SPEC.md`
- `README.md`
- `docs/policies/MEMORY_IMPORT_POLICY.md`
- `docs/policies/KNOWLEDGE_CURATION_ENGINE.md`

### Legacy Docs

The following locations are legacy reference material and should not be treated as canonical without verification:

- `zed-docs/`
- `docs/legacy/Agentic_Guide.md`
- `docs/legacy/Agentic_Guide_Add_On.md`
- `docs/legacy/SKILL.md`
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
- memory system behavior
- knowledge graph object lifecycle
- environment requirements

## Known Historical Notes

- The repo previously contained tracked local model artifacts under `models/`
- Those model artifacts were removed from current reachable history and should not be added again
- The repository was normalized to keep only `main` and `backup`
- New raw memory exports should be staged under `memory-imports/` and only merged into `hub/shared-memory/` after verification