# ZED AI — Multi-Agent Neural Interface System

## Overview
ZED is a multi-agent AI workforce built on an Express + React stack. It features a central hub architecture with an orchestrator that routes user requests to specialized agents.

## Architecture

### Stack
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Radix UI (port 5000)
- **Backend**: Express + TypeScript (serves frontend via Vite middleware in dev)
- **AI**: Ollama (local — qwen2.5:7b primary, llama3.2 fallback)
- **Database**: Neon PostgreSQL (drizzle-orm) with offline JSON fallback
- **Auth**: Local session-based auth (express-session)

### Agent System
```
User Request
    ↓
ManagerAgent (orchestrator/ManagerAgent.ts)
    ↓ routes based on keywords + context
    ├── OperationsAgent (ACTIVE) — exec assistant + social media
    ├── IntelligenceAgent (ACTIVE) — research + synthesis
    ├── IDEOperatorAgent (STUBBED) — code + IDE ops
    └── AudioEngineerAgent (STUBBED) — music production
```

### Hub Structure
```
server/hub/
├── config/
│   ├── personality.yaml   — voice, tone, boundaries, decision rules
│   ├── security.yaml      — permission tiers, approval gates
│   ├── parameters.yaml    — model selection, cost limits, timeouts
│   └── access.yaml        — API keys, paths, feature flags
├── shared-memory/
│   ├── working/           — active tasks, current session context
│   ├── episodic/          — conversation histories, decision logs
│   ├── semantic/          — domain knowledge, research corpus
│   └── consensus/         — approved voice/tone, verified procedures
├── templates/             — SKILL.md template for new agents
└── logs/                  — per-agent audit logs, routing logs
```

## Key Files
| File | Purpose |
|------|---------|
| `server/index.ts` | Main server entry point |
| `server/vite.ts` | Vite dev middleware integration |
| `server/routes.ts` | All API routes (includes `/api/orchestrate`) |
| `server/orchestrator/ManagerAgent.ts` | Request router — reads hub config, picks agent |
| `server/agents/operations/OperationsAgent.ts` | Active: exec + social |
| `server/agents/intelligence/IntelligenceAgent.ts` | Active: research |
| `server/agents/ide-operator/IDEOperatorAgent.ts` | Stubbed |
| `server/agents/audio-engineer/AudioEngineerAgent.ts` | Stubbed |
| `server/core.memory.json` | Startup identity/config for ZED |
| `server/hub/config/*.yaml` | Hub configuration files |
| `shared/schema.ts` | Shared TypeScript/Drizzle schemas |
| `client/src/App.tsx` | Frontend router (chat + login) |

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orchestrate` | POST | Main multi-agent endpoint |
| `/api/orchestrate/status` | GET | Agent system status |
| `/api/chat` | POST | Legacy direct-to-Ollama (preserved) |
| `/api/conversations` | GET/POST | Conversation management |
| `/api/auth/user` | GET | Current user |
| `/api/admin/system-test` | GET | System health check |

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | Neon PostgreSQL (falls back to offline JSON) |
| `SESSION_SECRET` | No | Session signing key |
| `OLLAMA_ENDPOINT` | No | Default: `http://localhost:11434` |
| `ANTHROPIC_API_KEY` | No | Optional — system runs fully local |
| `OPENAI_API_KEY` | No | Optional |
| `GITHUB_TOKEN` | No | For GitHub integration (future) |

## Running
```bash
cd server && npm run dev   # starts on port 5000
```

## Agent Activation (Stubbed → Active)
1. Review `agents/[agent-name]/SKILL.md` activation checklist
2. Configure required tools in `hub/config/access.yaml`
3. Set feature flags in `hub/config/access.yaml`
4. Get ADMIN approval
5. Test with `GET /api/orchestrate/status`

## Constraints (from Agentic_Guide.md)
- NEVER modify UI without `UI_REDESIGN_APPROVED` flag
- NEVER auto-execute financial transactions, external sends, or deployments
- ALWAYS run fully local first — no cloud dependencies required
- ALL external-facing agent actions require ADMIN approval gate
