# ZED AI — Multi-Agent Neural Interface System

## Overview
ZED is a multi-agent AI workforce built on an Express + React stack. A central hub architecture with a ManagerAgent orchestrator routes all user requests to specialist agents. Before routing, ManagerAgent injects shared memory (working, episodic, consensus) into every agent's system prompt. Web search (Brave/Serper) enriches IntelligenceAgent research. Tier enforcement (0–3) runs before any agent handles a message. All audit events write to `hub/logs/security.log`. Runs fully local — no cloud AI required.

## Architecture

### Stack
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Radix UI (port 5000)
- **Backend**: Express + TypeScript (serves frontend via Vite middleware in dev)
- **AI**: Ollama (local — qwen2.5:7b primary, llama3.2 fallback)
- **Database**: Neon PostgreSQL (drizzle-orm) with offline JSON fallback
- **Auth**: Session-based passphrase auth (express-session) — default: `XOCLON-SECURE-2025`
- **Vector Store**: ChromaDB client (optional, falls back to filesystem JSON)

### Request Pipeline
```
User Message
    ↓
Tier Enforcement (TierEnforcement.ts)
    ├── Tier-0: Hardblock — never proceeds
    ├── Tier-3: Hardblock — never exposes credentials
    └── OK → continue
    ↓
MemoryInjector (loads hub/shared-memory)
    ├── working/current-tasks.md
    ├── episodic/email-decisions.json + approval-queue.json
    └── consensus/posting-guidelines.md
    ↓
ManagerAgent.route() — keyword-based agent selection
    ├── IntelligenceAgent
    │   ├── WebSearchService (Brave → Serper → offline graceful)
    │   ├── ChromaService.querySimilarResearch (prior context)
    │   ├── generateChatFromOllama (with memory + search in system prompt)
    │   └── ChromaService.storeResearchBrief (semantic store)
    └── OperationsAgent
        ├── generateChatFromOllama (with memory + guidelines in system prompt)
        ├── Tier-2 trigger detection (send email / post / publish / delete…)
        ├── approval-queue.json write if triggered
        └── working memory + episodic memory write
    ↓
filterOutputForTier3 (redacts passphrase from any output)
    ↓
SecurityAudit.log (all tier blocks, approvals, auth events)
```

### Hub Structure
```
hub/
├── config/
│   ├── personality.yaml   — voice, tone, boundaries, decision rules
│   ├── security.yaml      — permission tiers, approval gates, audit config
│   ├── parameters.yaml    — model selection, agent params, routing config
│   └── access.yaml        — external API config, free-tier integrations
├── shared-memory/
│   ├── working/           — current-tasks.md (OperationsAgent task context)
│   ├── episodic/          — approval-queue.json, email-decisions.json
│   ├── semantic/          — research briefs per collection (ChromaDB fallback JSON)
│   └── consensus/         — posting-guidelines.md (brand voice for all agents)
├── templates/             — agent-template.md (blueprint for new agents)
└── logs/
    ├── security.log       — auth events, tier blocks, approval actions (JSONL)
    ├── routing-YYYY-MM-DD.log — ManagerAgent routing decisions
    ├── operations/        — OperationsAgent decisions per day
    └── intelligence/      — IntelligenceAgent research logs per day
```

## Key Files
| File | Purpose |
|------|---------|
| `server/index.ts` | Main server entry point |
| `server/routes.ts` | All API routes, tier enforcement on chat + orchestrate |
| `server/orchestrator/ManagerAgent.ts` | Orchestrator — loads hub config, injects memory, selects agents |
| `server/agents/operations/OperationsAgent.ts` | Active: exec assistant, drafts, approval queue |
| `server/agents/intelligence/IntelligenceAgent.ts` | Active: web search, research synthesis, semantic store |
| `server/agents/ide-operator/IDEOperatorAgent.ts` | Stubbed — needs ADMIN activation |
| `server/agents/audio-engineer/AudioEngineerAgent.ts` | Stubbed — needs ADMIN activation |
| `server/services/MemoryInjector.ts` | Loads hub memory → formatted context string for agent prompts |
| `server/services/WebSearchService.ts` | Brave API → Serper API → graceful offline fallback |
| `server/services/ChromaService.ts` | ChromaDB client with filesystem JSON fallback for 4 collections |
| `server/services/SecurityAudit.ts` | Writes security events to hub/logs/security.log |
| `server/middleware/TierEnforcement.ts` | Tier-0 + Tier-3 message blocking, output passphrase redaction |
| `server/services/Ollama/OllamaService.ts` | generateChatFromOllama, streamChatFromOllama, checkOllamaHealth |
| `server/localAuth.ts` | Passphrase auth, session management, security event logging |
| `client/src/pages/admin.tsx` | Admin panel — overview, ruleset editor, approval queue, logs |
| `hub/config/*.yaml` | Hub config files (loaded by ManagerAgent at startup, cache-busted on save) |

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orchestrate` | POST | Main multi-agent endpoint (tier checked, memory injected) |
| `/api/orchestrate/status` | GET | Agent system live status |
| `/api/chat` | POST | Legacy direct-to-Ollama |
| `/api/conversations` | GET/POST | Conversation management |
| `/api/conversations/:id/messages` | GET/POST | Messages + SSE streaming (tier checked) |
| `/api/conversations/:id/upload` | POST | File upload |
| `/api/admin/system-status` | GET | Ollama + DB + agent health |
| `/api/admin/ruleset` | GET/POST | Read/write hub config YAML files |
| `/api/admin/approval-queue` | GET | List approval queue entries |
| `/api/admin/approve/:id` | POST | Approve a queued action (logged to security.log) |
| `/api/admin/reject/:id` | POST | Reject a queued action (logged to security.log) |
| `/api/admin/security-log` | GET | Recent security audit events |
| `/api/admin/logs` | GET | Recent routing logs |

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | Neon PostgreSQL (falls back to offline JSON) |
| `SESSION_SECRET` | No | Session signing key |
| `BRAVE_SEARCH_API_KEY` | No | Brave search (IntelligenceAgent web search) |
| `SERPER_API_KEY` | No | Serper.dev search fallback |
| `CHROMA_URL` | No | ChromaDB server URL (default: http://localhost:8000) |
| `GITHUB_TOKEN` | No | GitHub read-only (future) |
| `FANTASMA_WEBHOOK_URL` | No | Fantasma SOC firewall integration (future) |
| `ZETA_CORE_SSE_URL` | No | Zeta Core threat alerts (future) |

## Running
```bash
cd server && npm run dev   # starts on port 5000
```

## Security Model
| Tier | Type | Enforcement |
|------|------|-------------|
| 0 | Hardblock | Regex match → instant block, security.log entry, no agent call |
| 1 | Auto-approve | Default for all info/research/draft tasks — no gate |
| 2 | Admin approval | OperationsAgent detects trigger keywords → queues draft → admin acts |
| 3 | Hardblock | Regex match for credential exposure → instant block + output redact |

## Memory System
- **Injection**: Every agent call receives working + episodic + consensus context in system prompt
- **Working memory**: OperationsAgent appends each interaction to `current-tasks.md`
- **Episodic memory**: Tier-2 actions logged to `email-decisions.json`
- **Semantic memory**: IntelligenceAgent stores research briefs to ChromaDB (or filesystem fallback)
  - Stored in `hub/shared-memory/semantic/semantic/` subdirectory
  - Prior similar research retrieved via `querySimilarResearch()` before each new query
- **Consensus**: `posting-guidelines.md` loaded by OperationsAgent for brand voice

## Approval Gate Flow
1. User sends message triggering a tier-2 action (e.g., "send email to...")
2. OperationsAgent detects trigger keyword, generates draft via Ollama
3. Draft written to `hub/shared-memory/episodic/approval-queue.json` with status: pending
4. Response returned with requiresApproval flag
5. Admin sees badge count on Approval Queue tab in Admin Panel
6. Admin approves or rejects — event logged to `hub/logs/security.log`

## Adding a New Agent
1. Copy `hub/templates/agent-template.md` as reference
2. Create `server/agents/[name]/SKILL.md` — define identity, capabilities, approval gates
3. Create `server/agents/[name]/[Name]Agent.ts` — implement with `generateChatFromOllama` + optional `memoryContext` param
4. Add import + routing case + `isActive()` guard to `server/orchestrator/ManagerAgent.ts`
5. Add to active/stubbed list in `/api/admin/system-status` and `/api/orchestrate/status`
6. Create `hub/logs/[name]/` directory

## Constraints
- NEVER modify UI without `UI_REDESIGN_APPROVED` flag
- NEVER auto-execute financial transactions, external sends, or deployments — all require approval gate
- ALWAYS run fully local first — no cloud AI dependencies required
- ALL external-facing agent actions (send, post, publish) require tier-2 admin approval
- Agent instruction context is injected via `generateChatFromOllama(messages, systemPrompt)` — NOT buildOllamaPrompt
- IDE Operator and Audio Engineer remain STUBBED — activate only with ADMIN approval
- Multi-user Trust model remains STUBBED — single admin only
