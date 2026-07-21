# ZAR Unified Capability System

Documentation retrieval, file intelligence, web research, and browser
automation, implemented as one capability system beneath the existing
Kernel (`ChatExecutionService` → `ZedAutonomousOrchestrator` → lane
agents) rather than five disconnected integrations.

## Architecture

```
User (iPhone / NEXUS communication surface)
  → existing chat + REST APIs (isAuthenticated)
  → ChatExecutionService (Kernel)                 — docs/context injection
  → IntelligenceAgent                             — fetch + bounded crawl
  → CapabilityRegistry                            — discovery + health
  → capability services (below)
  → Files / Knowledge graph / execution records
  → cited response
```

| Capability | Reference | Decision | Implementation |
|---|---|---|---|
| Documentation context | Context7 | Replaceable HTTP adapter over the hosted Context7 API (running the index locally is impractical; MIT server code not vendored). Provider shapes never leave the module. | `server/services/documentation/DocumentationContextService.ts` |
| File intelligence | MarkItDown | Native (MarkItDown is Python; ZAR is Node). pdf-parse, mammoth, xlsx, native OOXML-zip PPTX text extraction. | `server/services/fileProcessor.ts` (extends the existing Files pipeline) |
| Web research/crawl | Crawl4AI | Native bounded crawler over the hardened `WebContentService` (Crawl4AI is Python; the needed subset — readable extraction, dedup, canonical URLs, robots, limits — is small). | `server/services/WebContentService.ts`, `server/services/research/WebResearchJobService.ts` |
| Deterministic browser | Playwright MCP | playwright-core driving system Chromium behind typed action contracts; no MCP process, no raw Playwright exposure. | `server/services/browser/BrowserSessionService.ts`, `BrowserToolService.ts` |
| Goal-directed operator | Browser Use | Native bounded plan/act/observe loop over the typed tools (no second browser stack). | `server/services/browser/BrowserOperatorService.ts` |

Shared security root: `server/services/security/UrlSafetyGuard.ts` — SSRF
guard (scheme/userinfo checks, private/link-local/CGNAT/metadata IP
blocking for literals and DNS results, redirect-hop re-validation) used
by web fetch, crawl, robots, documentation adapter, and browser
navigation.

## Contracts and routes

- `GET /api/capabilities`, `GET /api/capabilities/health` — the single
  registry (`server/services/capabilities/CapabilityRegistry.ts`) serving
  both backend metadata and NEXUS discovery.
- `POST /api/documentation/resolve|retrieve`, `GET /api/documentation/health`
- `POST /api/web-research/fetch|crawl`, `GET /api/web-research/jobs[/:id]`,
  `POST /api/web-research/jobs/:id/cancel`
- `POST /api/browser/sessions`, `POST /api/browser/sessions/:id/actions`,
  `GET /api/browser/sessions[/:id]`, `POST /api/browser/sessions/:id/close`,
  `GET /api/browser/sessions/:id/artifacts/:index`
- `POST /api/browser/operator/tasks`, `GET .../:id`, `POST .../:id/cancel`
- Files continue through `POST /api/conversations/:id/upload` (extended,
  not replaced).

## Approval model

Browser actions are risk-classified: observation / reversible /
consequential (`submit`, `upload`). Consequential actions hard-require an
**approved** task in the existing execution pipeline
(`TaskLifecycleManager` + `/api/execution/approve` or
`/api/approval/decide`). An unapproved consequential action returns 202
with a freshly created pending approval task; the recorded
`approvalTaskId` lands in the session trace. The operator never executes
consequential steps — it parks in `awaiting_approval` with the pending
action recorded.

## Persistence

- `files` table: added `checksum`, `parser_used`, `conversion_status`,
  `structural_meta`, `duplicate_of_file_id` (idempotent migration in
  `server/migrations.ts`; checksum dedup happens at upload).
- Knowledge remains the existing graph authority
  (`KnowledgeIngestionService`); uploads and opted-in web research ingest
  through it with source citations.
- Research jobs, browser sessions, and operator tasks persist as bounded
  JSON audit stores under `hub/shared-memory/` — the same authority
  pattern the existing execution/approval layer uses for that domain.

## Environment variables

| Var | Purpose | Default |
|---|---|---|
| `CONTEXT7_API_KEY` | Optional docs-provider auth (higher limits) | unset |
| `CONTEXT7_BASE_URL` | Docs provider override | `https://context7.com/api` |
| `DOCS_CACHE_TTL_MS` | Documentation cache TTL | 30 min |
| `MAX_UPLOAD_BYTES` | Upload size cap | 50 MB |
| `BROWSER_EXECUTABLE_PATH` | Chromium binary when the playwright-core bundled revision is absent | unset |
| `BROWSER_SESSION_TTL_MS` / `BROWSER_MAX_SESSIONS_PER_USER` / `BROWSER_MAX_STEPS` | Session limits | 10 min / 2 / 60 |
| `BROWSER_OPERATOR_MAX_STEPS` / `BROWSER_OPERATOR_MAX_MS` | Operator budgets | 15 / 3 min |
| `WEB_ALLOW_LOOPBACK_FOR_TESTS` / `BROWSER_ALLOW_LOOPBACK_FOR_TESTS` | Test-fixture loopback escape hatches. **Never set in production.** | unset |

## Failure behavior

Documentation provider down → `provider_unavailable` (and the injected
prompt forbids inventing docs). Partial file conversion →
`conversion_status: partial` with per-section structure. Robots/SSRF
blocks → explicit error strings on the job/action record. Operator →
terminal states `step_limit_reached`, `time_limit_reached`, `blocked`,
`awaiting_approval`, `cancelled`, `failed`, with verification text
required for `completed`. Fetched web content is always wrapped in an
untrusted-data notice (prompt-injection isolation).

## Tests

`npx tsx --test` over: `server/services/security/__tests__/UrlSafetyGuard.test.ts`,
`server/services/__tests__/fileProcessor.test.ts`,
`server/services/research/__tests__/webResearch.test.ts`,
`server/services/documentation/__tests__/DocumentationContextService.test.ts`,
`server/services/browser/__tests__/browserTools.test.ts` (real Chromium
against a local fixture server; no public-website dependencies).
