# ZED AI — Multi-Agent Neural Interface System

## Overview
ZED is a multi-agent AI workforce built on an Express + React stack. A central hub architecture with a ManagerAgent orchestrator routes all user requests to specialist agents that read their SKILL.md instructions and generate responses via local Ollama. Everything runs fully local — no cloud AI required.

## Architecture

### Stack
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Radix UI (port 5000)
- **Backend**: Express + TypeScript (serves frontend via Vite middleware in dev)
- **AI**: Ollama (local — qwen2.5:7b primary, llama3.2 fallback)
- **Database**: Neon PostgreSQL (drizzle-orm) with offline JSON fallback
- **Auth**: Session-based passphrase auth (express-session) — default: `XOCLON-SECURE-2025`

### Agent System
```
User Request
    ↓
ManagerAgent (server/orchestrator/ManagerAgent.ts)
    ↓ reads hub/config/*.yaml, routes on keywords
    ├── OperationsAgent (ACTIVE) — exec assistant, task mgmt, social drafts
    ├── IntelligenceAgent (ACTIVE) — research, analysis, synthesis
    ├── IDEOperatorAgent (STUBBED) — code + IDE ops, needs ADMIN activation
    └── AudioEngineerAgent (STUBBED) — music production, needs ADMIN activation
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
│   ├── semantic/          — research briefs (IntelligenceAgent JSON dumps)
│   └── consensus/         — posting-guidelines.md (brand voice for all agents)
├── templates/             — agent-template.md (blueprint for new agents)
└── logs/
    ├── routing/           — ManagerAgent routing decisions (JSONL)
    ├── operations/        — OperationsAgent decisions per day
    └── intelligence/      — IntelligenceAgent research logs per day
```

## Key Files
| File | Purpose |
|------|---------|
| `server/index.ts` | Main server entry point |
| `server/routes.ts` | All API routes |
| `server/orchestrator/ManagerAgent.ts` | Orchestrator — loads hub config, selects + calls agents |
| `server/agents/operations/OperationsAgent.ts` | Active: exec assistant, drafts, approval queue |
| `server/agents/intelligence/IntelligenceAgent.ts` | Active: research synthesis, semantic store |
| `server/agents/ide-operator/IDEOperatorAgent.ts` | Stubbed — needs ADMIN activation |
| `server/agents/audio-engineer/AudioEngineerAgent.ts` | Stubbed — needs ADMIN activation |
| `server/services/Ollama/OllamaService.ts` | generateChatFromOllama, streamChatFromOllama, checkOllamaHealth |
| `server/services/Ollama/OllamaContextBuilder.ts` | buildOllamaPrompt (used by direct chat) |
| `client/src/pages/admin.tsx` | Admin panel — overview, ruleset editor, approval queue, logs |
| `hub/config/*.yaml` | Hub config files (loaded by ManagerAgent at startup, cache-busted on save) |

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orchestrate` | POST | Main multi-agent endpoint (all agent mode requests) |
| `/api/orchestrate/status` | GET | Agent system live status |
| `/api/chat` | POST | Legacy direct-to-Ollama |
| `/api/conversations` | GET/POST | Conversation management |
| `/api/conversations/:id/messages` | GET/POST | Messages + SSE streaming |
| `/api/conversations/:id/upload` | POST | File upload (credentials required) |
| `/api/admin/system-status` | GET | Ollama + DB + agent health |
| `/api/admin/ruleset` | GET/POST | Read/write hub config YAML files |
| `/api/admin/approval-queue` | GET | List approval queue entries |
| `/api/admin/approve/:id` | POST | Approve a queued action |
| `/api/admin/reject/:id` | POST | Reject a queued action |
| `/api/admin/logs` | GET | Recent routing logs |

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | Neon PostgreSQL (falls back to offline JSON) |
| `SESSION_SECRET` | No | Session signing key |
| `AUTH_PASSPHRASE` | No | Override default passphrase (default: XOCLON-SECURE-2025) |
| `BRAVE_SEARCH_API_KEY` | No | Brave search (IntelligenceAgent — optional) |
| `GITHUB_TOKEN` | No | GitHub read-only (IntelligenceAgent — optional) |
| `FANTASMA_WEBHOOK_URL` | No | Fantasma SOC firewall integration (future) |
| `ZETA_CORE_SSE_URL` | No | Zeta Core threat alerts (future) |

## Running
```bash
cd server && npm run dev   # starts on port 5000
```

## Approval Gate Flow
1. User sends message that triggers a tier-2 action (e.g., "send email to...")
2. OperationsAgent detects the trigger keyword, generates a draft
3. Response includes `[APPROVAL REQUIRED]` notice
4. Entry written to `hub/shared-memory/episodic/approval-queue.json`
5. Admin sees badge count on Approval Queue tab in Admin Panel
6. Admin reviews draft, approves or rejects

## Adding a New Agent
1. Copy `hub/templates/agent-template.md` as reference
2. Create `server/agents/[name]/SKILL.md` — define identity, capabilities, approval gates
3. Create `server/agents/[name]/[Name]Agent.ts` — implement using `generateChatFromOllama`
4. Add import + routing case to `server/orchestrator/ManagerAgent.ts`
5. Add to active/stubbed list in `/api/admin/system-status`
6. Create `hub/logs/[name]/` directory

## Constraints
- NEVER modify UI without `UI_REDESIGN_APPROVED` flag
- NEVER auto-execute financial transactions, external sends, or deployments — all require approval gate
- ALWAYS run fully local first — no cloud AI dependencies required
- ALL external-facing agent actions (send, post, publish) require tier-2 admin approval
- Agent instruction context is injected via `generateChatFromOllama(messages, systemPrompt)` — NOT buildOllamaPrompt
