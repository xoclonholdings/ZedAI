# ZED AI Specification

## Purpose

ZED AI is a multi-agent AI application built around an Express backend and a React/Vite frontend. The system supports chat, conversation history, file upload, admin controls, and orchestrated agent workflows backed by a Lightning AI–hosted model provider (reached via `claw-provider-temp`) and optional external services.

This file is the canonical project spec for the repository. If the project changes, update this document instead of spreading source-of-truth details across multiple Markdown files.

## Canonical Rules

- `SPEC.md` is the primary project specification.
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
  docs/             Canonical policies + execution audit
  hub/              Runtime shared-memory/config area
  scripts/local/    Local Windows workstation/model-host launchers
  server/           Express + TypeScript backend
  shared/           Shared schemas and cross-app types/config
  zed-memory/       Immutable raw ChatGPT export backup (not runtime)
  netlify.toml      Netlify deploy configuration (production is Render)
  package.json      Root package metadata
  package-lock.json Root dependency lockfile
  tsconfig.json     Root TypeScript config
  SPEC.md           Canonical project spec
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
- Message retrieval is handled under `/api/conversations/:id/messages`
- File listing and upload is handled under:
  - `/api/conversations/:id/files`
  - `/api/conversations/:id/upload`
- Chat execution runs through `/api/orchestrate`. The legacy `/api/chat` and `POST /api/conversations/:id/messages` bypass paths have been removed.

### Hidden Reasoning and Response Governance

- Response governance is implemented in `server/services/ZedResponseGovernance.ts`
- The governance prompt is injected before chat, agent, orchestrator, and legacy one-shot chat replies
- ZED must privately classify intent, choose task type, retrieve and check knowledge authority, detect missing context, reason through risks and next action, choose response form, and apply the ZED voice layer before answering
- User-facing replies should show the result, recommendation, risk, question, source links when requested, or a clean decision summary
- User-facing replies must not expose raw reasoning, tool calls, agent routing, workflow names, source-provider labels, search expansion, retrieval chunks, embedding matches, model synthesis, confidence math, hidden prompts, or backend logs by default
- If the user explicitly asks for process, sources, or workflow detail, ZED should provide a clean summary only, not raw internal logs or chain-of-thought
- Streaming chat buffers generated model text until the Voice + Presentation layer can apply `presentZedResponse` / `presentZedResponseWithChecks` before the response is sent to the client
- Research formatting includes sources only when the user asks for them and stores useful URLs without exposing provider names or expanded query trails

### Cognitive Core

The Cognitive Core is the active hidden reasoning chain used by normal chat and orchestrated agent replies. It is lightweight, service-owned, and intended to migrate into ZCOS later without changing the ZED interface.

Required runtime order:

1. Context Inquiry Engine checks whether missing or ambiguous context would materially change correctness, classification, storage, retrieval, or reasoning.
2. Principle Engine injects hidden operating principles before generation.
3. Strategic Reasoning Engine activates for strategy, architecture, product, business, roadmap, competitor, audit, planning, gap-analysis, and next-move questions.
4. Knowledge retrieval and orchestration provide canonical memory, rules, project context, and agent execution.
5. Voice + Presentation Engine produces the final user-visible response.
6. Reflection Engine stores safe post-response summaries for important replies only.

Runtime implementation:

- Context Inquiry: `server/services/knowledge-ingestion/ContextInquiryEngine.ts`
- Principle Engine: `server/services/ZedPrincipleEngine.ts`
- Strategic Reasoning Engine: `server/services/ZedStrategicReasoningEngine.ts`
- Voice + Presentation Engine: `server/services/ZedVoiceFormationEngine.ts`
- Response Governance: `server/services/ZedResponseGovernance.ts`
- Reflection Engine: `server/services/ZedReflectionEngine.ts`
- Chat execution wiring: `server/services/ChatExecutionService.ts`
- Orchestrator entry point: `server/routes-modules/orchestrate-and-misc.ts`
- Agent prompt integration: `server/orchestrator/ManagerAgent.ts`

The prompt fragments reach the model in the SPEC order above: governance is pinned first as a hard control frame, then context inquiry, then principle, then strategic reasoning, then the knowledge sources (foundation → personalization → project → scratchpad → retrieved), then voice, then response policy last so style guardrails win any ties. Both `ChatExecutionService` and `ManagerAgent` assemble their fragment lists in this order.

The Principle, Strategic Reasoning, and Reflection services must not expose raw chain-of-thought, hidden prompts, source trails, provider names, workflow names, internal scoring, route names, graph IDs, or retrieval internals to the user. If the user asks how an answer was produced, ZED should provide a clean implementation summary only.

### Intelligence Core

The Intelligence Core is a deterministic, service-owned layer inside the Cognitive Core that raises ZED's reasoning, context handling, document understanding, response shaping, and autonomy without changing the ZED interface. It adds five engines under `server/services/intelligence-core/`; all run synchronously with no extra model call, and all outputs are internal by default (revealed only when the user explicitly asks for reasoning).

- Deep Thinking Mode (`DeepThinkingEngine.ts`) — scores request complexity and, on genuinely complex work, runs a staged internal pipeline (decomposition → hypothesis generation → solution evaluation → refinement → confidence estimation) injected as a hidden reasoning scaffold. Available to every lane/workspace.
- Large Context Intelligence (`ContextIntelligenceEngine.ts`) — treats all retrieved knowledge blocks as one pool, ranks each by relevance to the live query, de-duplicates overlapping lines across sources, compresses low-signal blocks, and enforces a character budget. Project instructions and uploaded files are pinned so they always survive.
- Document Intelligence (`DocumentIntelligenceService.ts`) — pushes every uploaded conversation file through the existing Knowledge Ingestion pipeline into the same Knowledge Graph (no duplicate store), then retrieves document-derived knowledge for later queries with source attribution, citations, and conflict awareness.
- Adaptive Response Intelligence (`ResponseOrchestrationEngine.ts`) — reads intent, complexity, urgency, task type, and required depth/precision, then emits a per-message directive that picks the response form (direct, steps, checklist, table, comparison, report, executive summary, code) and verbosity, instead of a static template.
- Self-Orchestrating Intelligence (`SelfOrchestrationEngine.ts`) — decides which capabilities a turn needs (search memory / knowledge graph / documents, launch research, call an agent lane, schedule, request approval, generate a report, calculate, run a workflow, update project state, notify) and emits a capability activation plan. Outward actions are flagged non-autonomous so the existing approval policy still owns the side effect.

Wiring:

- Facade: `server/services/intelligence-core/index.ts` (`IntelligenceCore.analyze`)
- Hot-path integration: `server/services/ChatExecutionService.ts` runs the reasoning engines, applies Context Intelligence over the assembled knowledge blocks, and retrieves Document Knowledge; the resulting plan is recorded on the execution trace (`intelligencePlan`, `contextCompressionRatio`, `documentCitations`) and in response metadata.
- Upload ingestion: `server/routes-modules/conversations-crud.ts` (`POST /api/conversations/:id/upload`) ingests each processed file into the graph, embedding the summary in the file's `analysis.documentIntelligence`.
- Observability/preview: `server/routes-modules/intelligence-core.ts` exposes `POST /api/intelligence/plan`, `POST /api/intelligence/documents/query`, and `GET /api/admin/intelligence-core/status`.

The Intelligence Core prompt fragments slot into the existing Cognitive Core order: the Deep Thinking + Self-Orchestration reasoning fragments sit with Strategic Reasoning (before knowledge), the ranked/compressed knowledge block replaces the raw concatenation of retrieved sources, and the Adaptive Response directive sits just before Voice — governance still pinned first, response policy still pinned last. A safety net falls back to the raw retrieved sources if ranking ever yields empty output, preserving backward compatibility.

Reflection stores concise summaries of important exchanges under project memory type `reflection`. Reflection summaries must describe user intent, visible answer, approval relevance, and strategic relevance only. They must not store hidden reasoning, prompt text, tool logs, provider traces, or raw internal state.

### Plain-Language Settings Surface

The admin Settings tab is the primary control surface for how ZED behaves at runtime. It is plain-language on purpose — no YAML editors, no raw parameter fields — and each category maps to a concrete runtime effect.

Categories with fully-built runtime wiring:

- `How Zed sounds` — tone, formality, perspective, response length, plain-language toggle, prohibited phrases. Persists at `hub/config/admin-settings.json` under `voice`. `server/services/voiceSettings.ts` renders the prompt fragment; `server/services/voiceSettingsToGeneration.ts` derives generation params (temperature, max tokens, top_p) per lane and forwards them through the provider layer.
- `What needs your approval` — per-action three-way policy (Auto / Ask me / Never) covering send email, calendar, cancel appointment, send message, reach out to contacts, post to social, publish content, make payment, send invoice, delete data, update credentials, deploy code, create task. `server/services/approvalPolicy.ts` matches each user message to a category and consults the stored policy before the agent runs. `Never` short-circuits with a refusal reply logged as `policy_refused`; `Ask` queues for admin approval; `Auto` dispatches directly.

Categories placeheld pending build: Tools, Response length/style, Sensitive topics, Session/safety, Personal memory. Their underlying behavior is still shaped by the raw ruleset until each ships.

Every setting autosaves debounced; server-side merge normalizes and clamps unknown values to safe defaults (e.g. an unrecognized approval mode becomes `ask`, never silently `auto`).

### Per-User Personalization Corpus

Each user can save markdown notes about themselves at `hub/user-personalization/<userId>/notes/<slug>.md`. `UserPersonalizationCorpus.retrievePersonalizationForQuery` keyword-scores those notes against the current query and returns a block that `KnowledgeService.buildContext` slots into the Cognitive Core knowledge stack right after Foundation. Each user only ever reads and writes their own directory. The corpus is retrieval-only — nothing here writes back to `zed-memory/`, which remains an immutable raw backup.

### Access Policy Enforcement

`hub/config/access.yaml` describes the external-API policy (`no_paid_apis`) and the whitelisted free-tier services (Brave search, Serper, GitHub, Fantasma, Zeta Core). `server/services/AccessPolicyService.ts` loads the yaml on demand and exposes `consultExternalService(name)` — every call is audit-logged to `hub/logs/security.log` as `policy.external_api.consulted` or `policy.external_api.denied` so operators can see the policy actually consulted at the call site. `WebSearchService` consults the policy before either Brave or Serper; a provider that isn't in the whitelist is denied even if its env key is set. `GET /api/admin/access-policy` returns the effective policy for admin surfaces to render.

### Runtime Error Self-Repair

When a runtime action fails, Zed inspects the failure, chooses a bounded repair strategy, and retries — instead of writing the error to a log and moving on. `server/services/SelfRepairService.ts` wraps `DigitalExecutionService.execute` and consults a deterministic strategy map keyed off the typed `failureReason` (e.g. `smtpDispatchFailed` → retry with exponential backoff; `providerDisabled` / `providerNotConfigured` → escalate to user, no retry). Bounded at 3 attempts per call; a reasoning trail (attempt, strategy, reason, waited, outcome) is returned alongside the final result and logged to `runtime.log` as `self_repair.outcome`. `POST /api/admin/subsystems/self-repair/execute` runs a DigitalExecutionRequest through this loop and returns the trail.

Non-goals for this pass: LLM-driven reasoning over arbitrary failure modes. That layers on later; the deterministic map handles today's known failure types cleanly and doesn't invent retries against providers that are truly down.

### Runtime Trace Validation

Every request through `ChatExecutionService` assembles an `ExecutionTrace` (traceId, route, selectedAgent, servicesInvoked, toolsInvoked, providerUsed, presentationAdjustments, status, failureReason). `server/services/TraceValidator.ts` audits each trace before it's logged: a success trace must carry `selectedAgent`, non-empty `servicesInvoked`, and a `providerUsed`; a failed trace must carry a `failureReason`; every trace must carry `traceId`, `route`, `executionStatus`. Violations are non-blocking but recorded to `runtime.log` as `trace.validation.violation`. `GET /api/admin/traces` returns recent traces with violations interleaved.

### Streaming

Per the buffer requirement above, the provider layer supports true streaming via `streamProviderChat`, and `ModelProviderService.generateBufferedStreamFromProvider` streams-then-buffers so callers get provider-timeout resilience while presentation still runs on complete text. `OperationsAgent` is the pilot lane; other agents can migrate with a one-line swap from `generateChatFromProvider`.

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
- `FinanceAgent` is one phased specialist feature for trading, crypto/web3, forex, market opportunity, accumulation strategy, wealth-building, and capital allocation analysis
- The current FinanceAgent phase is Trading Intelligence: disciplined market analysis, paper-trading validation, strategy audits, trade thesis generation, risk controls, journal review, and performance analytics; this phase does not execute live trades, transmit orders, move funds, or manage live capital
- Later FinanceAgent phases expand the same feature, not a separate entity, into broader market opportunity, accumulation strategy, wealth-building, and capital allocation workflows while preserving the same evidence, validation, approval, and risk-control requirements
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

### Knowledge Ingestion and Context

- Structured ingestion lives under `server/services/knowledge-ingestion/` and is registered through `server/routes-modules/knowledge-ingestion.ts`.
- Imported content is normalized into candidate knowledge first. It is not treated as canonical until validated or promoted.
- The ingestion pipeline performs source analysis, semantic decomposition, object detection, relationship mapping, timeline detection, decision extraction, conflict detection, duplicate-aware graph integration, and reasoning-index generation.
- The service creates durable graph state at runtime under `hub/shared-memory/knowledge-graph/knowledge-graph.json`.
- Graph objects retain current truth, historical truth, evidence, confidence, contradictions, open questions, related objects, temporal status, and candidate/canonical state.
- Conflict resolution never overwrites silently. Resolved conflicts preserve the conflict record and update affected objects with a reviewed truth state.
- The Context Inquiry Engine sits between retrieval and response generation. It scores completeness, confidence, recency, relationship density, conflict count, context depth, and unknown fields.
- The Context Inquiry Engine returns `answer` only when uncertainty is immaterial. It returns `inquire_first` with minimal high-value questions when missing context would change classification, storage, reasoning, retrieval, or conflict resolution.
- This subsystem is intentionally service-owned and UI-agnostic so it can become a future ZCOS service.

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
  - `GET /api/admin/knowledge/curation`

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
  - `curation/`
  - `knowledge-graph/`
- Structured candidate/canonical graph memory is persisted at runtime under:
  - `hub/shared-memory/knowledge-graph/knowledge-graph.json`
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
- Knowledge curation review output is persisted under:
  - `hub/shared-memory/curation/latest-review.json`
  - `hub/shared-memory/curation/review-history.jsonl`
- `zed-memory/` is retained as a read-only raw backup archive and is not the active runtime memory source
- The backup/archive role of `zed-memory/` is documented in `zed-memory/LEGACY_BACKUP_MANIFEST.md`

### Knowledge Curation and Evolution Engine

The Knowledge Curation and Evolution Engine is an active runtime memory system after the Knowledge Ingestion Engine and Context Engine. Its role is to act on what the first two systems learned by continuously maintaining knowledge quality, organization, accuracy, and long-term evolution.

Runtime implementation:

- Service: `server/services/KnowledgeCurationEngine.ts`
- Route wiring: `server/routes-modules/knowledge.ts`
- Startup scheduler: `server/index.ts`
- Latest review output: `hub/shared-memory/curation/latest-review.json`
- Review history output: `hub/shared-memory/curation/review-history.jsonl`
- Default scheduler interval: every 6 hours, with an initial review scheduled shortly after server boot
- Environment controls:
  - `ZED_KNOWLEDGE_CURATION_DISABLED=true` disables the background scheduler
  - `ZED_KNOWLEDGE_CURATION_INTERVAL_MS` overrides the review interval, with a 60 second minimum

Knowledge is treated as a living system. New information must strengthen, refine, replace, extend, or question existing knowledge instead of simply accumulating as disconnected documents.

The engine actively monitors memory-backed knowledge objects for:

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

Every knowledge object receives a dynamic health score based on completeness, confidence, context depth, relationship density, source diversity, freshness, conflict count, verification status, and user confirmation. Low-health objects become candidates for refinement.

When new information arrives, the engine can compare it against existing objects and classify the effect as confirmation, expansion, contradiction, supersession, merge, replacement, creation, or clarification need. It should not create duplicate knowledge when an existing canonical object can be refined.

Every concept should have one canonical object. Non-canonical material should be represented as an alias, historical version, rejected proposal, archived draft, or supporting evidence. The canonical object represents ZED's current understanding.

Knowledge should evolve rather than disappear. Version history must preserve original state, updated state, reason for change, user clarification, supporting evidence, timestamp, confidence before, and confidence after.

The engine continuously strengthens relationships across projects, research, agents, workflows, goals, tasks, people, companies, frameworks, books, ideas, specifications, and learning paths. It also generates automatic living collections from the graph during reviews.

Knowledge aging marks objects as recently updated, stable, needs review, potentially outdated, or historical. Older information must not be assumed correct without freshness and verification checks.

The engine actively identifies learning gaps and generates recommended clarification questions, such as missing objectives, owners, rationales, specifications, evidence, or decision records.

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
- `GET /api/knowledge/curation/latest`
- `POST /api/knowledge/curation/review`
- `POST /api/knowledge/curation/evaluate`
- `POST /api/knowledge-ingestion/import`
- `GET /api/knowledge-ingestion/graph`
- `GET /api/knowledge-ingestion/indexes`
- `POST /api/knowledge-ingestion/promote`
- `POST /api/knowledge-ingestion/conflicts/:id/resolve`
- `POST /api/context/assess`
- `POST /api/intelligence/plan`
- `POST /api/intelligence/documents/query`
- `GET /api/admin/intelligence-core/status`
- `POST /api/orchestrate`
- `GET /api/orchestrate/status`
- `POST /api/voice/transcribe`
- `GET /api/admin/system-status`
- `GET /api/admin/knowledge/curation`
- `GET /api/admin/ruleset`
- `POST /api/admin/ruleset`
- `GET /api/admin/logs`
- `GET /api/admin/approval-queue`
- `POST /api/admin/approve/:id`
- `POST /api/admin/reject/:id`
- `GET /api/admin/security-log`
- `GET /api/admin/system-test`
- `GET /api/admin/traces`
- `GET /api/admin/access-policy`
- `PUT /api/admin/settings/voice`
- `POST /api/admin/settings/voice/reset`
- `PUT /api/admin/settings/approvals`
- `POST /api/admin/settings/approvals/reset`
- `GET /api/me/personalization/notes`
- `GET /api/me/personalization/notes/:slug`
- `POST /api/me/personalization/notes`
- `DELETE /api/me/personalization/notes/:slug`

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
- Keyword expansion is internal response machinery and should not appear in normal user-facing research answers
- FinanceAgent shares market-research context with the R&D/Intelligence lane, but remains one phased finance feature whose current Trading Intelligence phase focuses on paper-trading validation, market-structure analysis, strategy audits, and risk management before later expansion into broader opportunity and capital-allocation workflows
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
- `server/routes-modules/knowledge.ts`
- `server/routes-modules/knowledge-ingestion.ts`
- `server/services/KnowledgeCurationEngine.ts`
- `server/services/knowledge-ingestion/`
- `server/services/ZedResponseGovernance.ts`
- `server/services/ZedResponsePolicy.ts`
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

At server boot, ZED initializes runtime directories, fallback storage, core memory, and the Knowledge Curation scheduler. The scheduler writes curation reports under `hub/shared-memory/curation/` and logs review status to the runtime log.

The backend is deployed to Render; configuration lives in the Render dashboard
(environment variables, build/start command, optional persistent disk).

## Documentation Policy

### Active Docs

- `SPEC.md`
- `README.md`
- `docs/policies/MEMORY_IMPORT_POLICY.md`
- `docs/policies/KNOWLEDGE_CURATION_ENGINE.md`

### Legacy Docs

Agent-specific skill markdown lives under `server/agents/**`. Those files are per-agent behavior notes; if one conflicts with this spec or the code, the code and `SPEC.md` win. The earlier `zed-docs/` tree and `docs/legacy/` files (Agentic_Guide*, SKILL.md) were removed in Phase 3 cleanup — they referenced Ollama, Netlify Functions, and the retired `/api/chat` route and were long superseded.

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
- response governance behavior
- environment requirements

## Known Historical Notes

- The repo previously contained tracked local model artifacts under `models/`
- Those model artifacts were removed from current reachable history and should not be added again
- The repository was normalized to keep only `main` and `backup`
- New raw memory exports should be staged under `memory-imports/` and only merged into `hub/shared-memory/` after verification
