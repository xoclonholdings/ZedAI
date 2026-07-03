# ZED Execution Audit

Audit date: 2026-07-02
Repository: `xoclonholdings/ZedAI`

## Executive Status

- Overall System Status: PARTIAL, with P0 chat/orchestration wiring improved on 2026-07-02.
- Highest Severity Issue: Provider-backed external actions still require configured credentials and runtime verification. Chat now creates structured approval/dispatch metadata, but live SMTP/calendar/API execution remains UNVERIFIED without credentials.
- Primary Root Cause: ZED had multiple chat execution paths and capability-specific services that were not consistently reached from normal requests. The active implementation now routes `/api/orchestrate`, `/api/chat`, and `/api/conversations/:id/messages` through `ChatExecutionService`, but several downstream providers remain credential-gated.

Build verification:

- PASS: `npm.cmd run smoke` in `server`
- PASS: `npm.cmd run build` in `client`
- PASS: `..\server\node_modules\.bin\tsc.cmd --noEmit -p ..\tsconfig.json` from `server`

Important workspace note: `server/routes-modules/orchestrate-and-misc.ts` was already modified before this audit.

## 2026-07-02 Execution Wiring Update

These fixes were applied after the baseline audit. Items below are verified only to the level stated.

| Area | Status after fix | Evidence | Verification |
|---|---|---|---|
| Authoritative chat path | PARTIAL: `/api/orchestrate`, `/api/chat`, and `/api/conversations/:id/messages` now call `ChatExecutionService`; legacy SSE shape is preserved as a wrapper. | `server/services/ChatExecutionService.ts`, `server/routes-modules/orchestrate-and-misc.ts`, `server/routes-modules/conversations-send-clean.ts`, `server/routes-modules/conversations-send.ts` | TypeScript noEmit PASS. Runtime login/chat trace still needs browser/API verification. |
| Empty/template output handling | PARTIAL: shared executor rejects empty/template upstream output as failed execution metadata before storage; client no longer invents "No response"; provider helper returns empty text instead of placeholder text. | `server/services/ChatExecutionService.ts`, `client/src/components/chat/chat-area/sendAgentMessage.ts`, `server/core/providers/provider-helpers.ts` | Static search confirms active direct placeholders removed outside sanitizer/policy text. Forced empty-provider runtime test remains UNVERIFIED. |
| Execution trace IDs | PARTIAL: chat responses and assistant metadata now include `traceId`, route, selected agent, classifier result, service/tool arrays, provider, context flags, file refs, presentation adjustments, status, failure, and mocked flag. | `server/services/ChatExecutionService.ts`, `server/orchestrator/ManagerAgent.ts`, `server/orchestrator/manager-agent/agent-selection.ts` | TypeScript noEmit PASS. End-to-end runtime trace inspection remains UNVERIFIED. |
| ManagerAgent routing evidence | PARTIAL: selection now returns structured classifier/fallback metadata and selected-agent service lists. | `server/orchestrator/manager-agent/agent-selection.ts`, `server/orchestrator/ManagerAgent.ts` | Static/type verification PASS. Route prompt tests remain UNVERIFIED. |
| Research/web execution | PARTIAL: direct URL fetch retains page metadata, bounded same-origin discovery supports blog/about/pricing/contact/docs/news, quote requests extract a quote from fetched content, and prior website references resolve from metadata first. | `server/services/WebContentService.ts`, `server/agents/intelligence/IntelligenceAgent.ts`, `server/services/ChatExecutionService.ts` | TypeScript noEmit PASS. Live fetch tests require network/runtime and remain UNVERIFIED. |
| Presentation masking | PARTIAL: flow suggestions are metadata-only; presentation adjustments are saved; empty output now records `upstream_output_empty_preserved_failure`. | `server/zcos/orchestration/ZedAutonomousOrchestrator.ts`, `server/services/ZedVoiceFormationEngine.ts`, `server/services/ChatExecutionService.ts` | Static/type verification PASS. Forced empty upstream runtime test remains UNVERIFIED. |
| Operations approvals | PARTIAL: operations requests produce structured tasks and approval ids; approval route attempts `ExecutionPipeline.dispatch` when dispatch payload exists; disabled providers return `providerDisabled` failure instead of mock success. | `server/agents/operations/OperationsAgent.ts`, `server/services/approval/AgentApprovalAdapter.ts`, `server/routes-modules/approvals.ts`, `server/services/execution/DigitalExecutionService.ts` | TypeScript noEmit PASS. SMTP/live dispatch remains UNVERIFIED without credentials. |
| Project/file context | PARTIAL: chat payload includes selected project id; context builder accepts direct `projectId`; chat executor injects conversation file extracted content and records file/project metadata. | `client/src/components/chat/ChatArea.tsx`, `client/src/components/chat/chat-area/sendAgentMessage.ts`, `server/services/ZedContextBuilder.ts`, `server/services/ChatExecutionService.ts` | TypeScript/client build PASS. Project/file runtime prompts remain UNVERIFIED. |
| Flows | PARTIAL: flow stages call real agents for research, finance, operations, and business lanes; model-only/local stages are explicitly marked in stage output. | `server/services/flow/FlowExecutor.ts` | TypeScript noEmit PASS. Published flow runtime run remains UNVERIFIED. |
| Trading chat | PARTIAL: finance chat can parse and write complete paper-trade log requests to `TradingStore.openPaperTrade`; missing fields are reported specifically. | `server/agents/finance/FinanceAgent.ts` | TypeScript noEmit PASS. Runtime record creation remains UNVERIFIED. |
| Admin security | PARTIAL: `/api/admin/system-test` now uses `isAdmin`; registered admin routes reviewed by static search show `isAdmin` guards. | `server/routes-modules/orchestrate-and-misc.ts`, `server/routes-modules/*` | Static verification PASS. Anonymous/normal-user HTTP denial tests remain UNVERIFIED. |

Latest verification run:

- PASS: `npm.cmd run smoke` in `server`
- PASS: `npm.cmd run build` in `client`
- PASS: `.\server\node_modules\.bin\tsc.cmd --noEmit -p .\tsconfig.json` from repo root
- NOT RUN: live browser/API chat trace test, live website fetch test, SMTP dispatch test, admin denial HTTP test. These require running server/session credentials and, for external actions, configured provider credentials.

## 2026-07-02 Completion Verification Update

The follow-up completion pass added `server/scripts/executionVerification.ts` and `npm run verify:execution` in `server`. This script uses deterministic local fixtures and restores runtime JSON files after tests. It does not require Ollama/OpenAI, external web access, SMTP credentials, or a database.

Verified PASS items:

| Area | Verified status | Evidence | Exact verification |
|---|---|---|---|
| Route selection | PASS | `server/orchestrator/manager-agent/agent-selection.ts` | `npm run verify:execution` asserts research, finance, business, and operations route decisions. It also verifies classifier fallback metadata with `ZED_ROUTER_DISABLE_LLM_CLASSIFIER=true`. |
| Email-address routing bug | PASS | `server/orchestrator/manager-agent/agent-selection.ts`, `server/services/WebContentService.ts` | `npm run verify:execution` proves `test@example.com` no longer triggers web routing. |
| Direct URL fetch and page discovery | PASS for local deterministic fetch/discovery | `server/services/WebContentService.ts` | Local HTTP fixture verifies homepage fetch, same-origin `/blog` discovery, fetched metadata, and readable blog content. |
| Prior website reference resolution | PASS | `server/services/ChatExecutionService.ts` | Test verifies "that website" resolves from assistant message metadata before raw text scanning. |
| Empty upstream output rejection | PASS | `server/services/ChatExecutionService.ts`, `server/core/providers/provider-helpers.ts` | Test forces empty upstream route output and asserts `executionStatus=failed`, `failureReason=upstream_empty_output`, and no empty assistant message is stored. |
| Chat trace metadata | PASS | `server/services/ChatExecutionService.ts` | Test asserts route, selected agent, file/project/workspace flags, trace id, and assistant message metadata. |
| Project context injection | PASS | `server/services/ZedContextBuilder.ts`, `server/services/ProjectFilingStore.ts` | Test creates/restores a project fixture with Project Orchid instructions and verifies context text/meta. |
| File context injection | PASS | `server/services/ChatExecutionService.ts` | Test patches conversation files and verifies `fileContextUsed=true` plus `filesReferenced[]`. |
| Operation approval payload | PASS | `server/agents/operations/OperationsAgent.ts`, `server/services/approval/AgentApprovalAdapter.ts`, `server/routes-modules/approvals.ts` | Test creates/restores an approval task and verifies dispatch payload is stored on the task log. |
| Provider-disabled execution failure | PASS | `server/services/execution/DigitalExecutionService.ts` | Test verifies disabled email provider returns failed `providerDisabled` and `mocked=false`. |
| Real SMTP code path | PASS for code wiring, UNVERIFIED for live delivery | `server/services/execution/DigitalExecutionService.ts` | Code now resolves SMTP from env/admin settings and calls `nodemailer.sendMail`. Live delivery requires credentials. |
| Trading chat paper trade write | PASS | `server/agents/finance/FinanceAgent.ts`, `server/zcos/trading/TradingStore.ts` | Test writes/restores a paper trade and verifies the created `recordId` exists in `paper-trades.json`. |
| Flow stage agent execution | PASS for direct stage adapter | `server/services/flow/FlowExecutor.ts` | Test calls exported `executeAgentStage` for a finance stage and verifies `stageExecutionType=agent`, `agentInvoked=FinanceAgent`, and service trace. Published end-to-end flow run remains UNVERIFIED. |
| Admin denial | PASS for middleware | `server/local-auth/middleware.ts`, `server/routes-modules/orchestrate-and-misc.ts` | Test calls `isAdmin` with a normal user session and verifies 403/no next call. Full HTTP session test remains UNVERIFIED. |

Latest full verification suite:

- PASS: `npm.cmd run smoke` in `server`
- PASS: `npm.cmd run build` in `client`
- PASS: `.\server\node_modules\.bin\tsc.cmd --noEmit -p .\tsconfig.json`
- PASS: `.\node_modules\.bin\tsx.cmd scripts\executionVerification.ts` in `server`

Remaining UNVERIFIED items after completion pass:

- Live SMTP delivery with real provider credentials.
- Live external website fetch against `https://zwap.online` from the deployed/runtime environment.
- Full authenticated browser/API chat trace inspection using real sessions.
- Full published research flow run through `/api/flows/*`.
- Anonymous/normal/admin HTTP authorization tests against a running server.

## 2026-07-03 Live Runtime Verification Update

The follow-up live pass added `server/scripts/liveExecutionVerification.ts` and `npm run verify:live` in `server`. The script prints configuration presence only; it does not print secrets. It optionally uses `LIVE_ZED_BASE_URL` to verify a running server with real HTTP sessions.

Verified PASS items:

| Area | Verified status | Evidence | Exact verification |
|---|---|---|---|
| Live external direct fetch | PASS | `server/services/WebContentService.ts`, `server/scripts/liveExecutionVerification.ts` | `npm.cmd run verify:live` fetched `https://zwap.online`, discovered `https://zwap.online/blog`, and read both pages with HTTP 200. |
| Live anonymous admin denial | PASS | `server/local-auth/middleware.ts`, `server/routes-modules/admin-settings.ts` | `LIVE_ZED_BASE_URL=http://127.0.0.1:5000 npm.cmd run verify:live` returned HTTP 401 for anonymous `GET /api/admin/settings`. |
| Live admin allow | PASS | `server/local-auth/routes-login.ts`, `server/routes-modules/admin-settings.ts` | The verifier logged in with the local admin secure phrase and received HTTP 200 from `GET /api/admin/settings`. |
| Live normal-user admin denial | PASS | `server/services/AdminSettingsStore.ts`, `server/local-auth/middleware.ts` | The verifier created a temporary normal user, logged in, received HTTP 403 from `GET /api/admin/settings`, and restored `admin-settings.json`. |
| Live `/api/orchestrate` trace response | PASS for trace visibility | `server/services/ChatExecutionService.ts`, `server/scripts/liveExecutionVerification.ts` | The verifier received an execution trace with `traceId`, `route=/api/orchestrate`, `detectedIntent=web_research`, `servicesInvoked[]`, `executionStatus=failed`, and provider metadata. |
| Offline memory/message storage guards | PASS | `server/storage/MemoryDatabaseStorage.ts`, `server/storage/MessageDatabaseStorage.ts` | Offline mode now short-circuits DB-null reads and returns fallback records for message/memory writes instead of throwing `db.insert` before trace creation. |
| Provider failure metadata | PASS | `server/services/ChatExecutionService.ts` | Missing local Ollama now reports `modelProviderUnavailable:ollama:http://localhost:11434` instead of generic `fetch failed`. |

Remaining PARTIAL / UNVERIFIED after live pass:

- Chat runtime completion is PARTIAL in this shell because no model provider is reachable. Live trace works, but the request ends with `executionStatus=failed` and `failureReason=modelProviderUnavailable:ollama:http://localhost:11434`.
- Search-provider execution remains PARTIAL because no Brave/Serper keys are visible. Direct URL fetch is verified and does not depend on those keys.
- Live SMTP delivery remains UNVERIFIED because `EMAIL_PROVIDER_ENABLED` is false and no complete SMTP env/admin account is configured.
- Full published flow execution through `/api/flows/*` remains UNVERIFIED.
- Deployed-environment verification remains UNVERIFIED; all live HTTP tests above were against `http://127.0.0.1:5000`.

## Capability Matrix

| Capability | User-facing entry point | Backend route(s) | Service/agent/engine involved | Exists | Wired | Functional | Utilized by ZED | Evidence files | Failure mode | Required fix | Verification test |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Primary chat dispatch | `/chat`, `ChatArea` composer | `POST /api/orchestrate` | `ZedAutonomousOrchestrator`, `ManagerAgent`, selected agent, response governance | yes | yes | partial | yes | `client/src/components/chat/ChatArea.tsx`, `client/src/components/chat/chat-area/sendAgentMessage.ts`, `server/routes-modules/orchestrate-and-misc.ts`, `server/zcos/orchestration/ZedAutonomousOrchestrator.ts`, `server/orchestrator/ManagerAgent.ts` | No streaming in active path; failures return governed fallback JSON. | Add trace IDs and structured execution proof to `/api/orchestrate`; expose real selected-agent, service calls, and provider status. | Login, send a normal prompt, assert `/api/orchestrate` stores user/assistant messages and metadata.agent. |
| Legacy SSE chat route | Not imported by current `ChatArea` | `POST /api/conversations/:id/messages` | Memory injection, web shortcut, direct model lane | yes | partial | unverified | no in current UI | `server/routes-modules/conversations-send.ts`, `client/src/components/chat/chat-area/sendChatMessage.ts`, `rg sendChatMessage` | Registered but shadowed; active UI does not import `sendChatMessage`. Contains `(no response)` and direct-model bypass paths. | Either remove/deprecate or make current UI use it intentionally. Keep one chat route. | Static import test: fail CI if `sendChatMessage` is unused while route remains registered. |
| ManagerAgent orchestration | `/chat`, `/api/orchestrate`, legacy route web path | `POST /api/orchestrate` | `ManagerAgent.route`, `selectAgent`, LLM classifier, keyword fallback | yes | yes | partial | yes | `server/orchestrator/ManagerAgent.ts`, `server/orchestrator/manager-agent/agent-selection.ts` | LLM classifier failure silently falls back to keywords; selected agents mostly generate text rather than execute tools. | Log route decision, classifier result, fallback reason, selected agent, and tool calls into response metadata and runtime logs. | Send finance/business/research/operations prompts and assert expected `metadata.agent` and runtime route log. |
| Research and direct URL fetch | Chat web prompts, `/api/orchestrate` | `/api/orchestrate`; legacy `/messages` | `IntelligenceAgent`, `WebContentService`, `WebSearchService`, `ChromaService` | yes | yes | partial | yes for web intents | `server/agents/intelligence/IntelligenceAgent.ts`, `server/services/WebContentService.ts`, `server/services/WebSearchService.ts` | Direct URLs are fetched. Search only works with Brave/Serper keys. No site crawling or `/blog` discovery beyond URLs in text/recent history. | Add explicit crawl/discovery service for "quote the blog page"; return fetch/search attempt metadata and source URLs by default for research. | Prompt with a local test URL and verify fetched page content appears; prompt "visit the blog page" and verify discovery works or asks for URL. |
| Prior webpage reference resolution | Follow-up prompt like "read that site" | `/api/orchestrate`; legacy `/messages` | `resolveReferencedWebpage`, `extractWebTargets` | yes | yes | partial | yes | `server/routes-modules/orchestrate-and-misc.ts`, `server/routes-modules/conversations-send.ts`, `server/services/WebContentService.ts` | Only looks for explicit URL in recent message history; does not use stored source objects or browser session state. | Store fetched URL/page metadata in message metadata and resolve by conversation state, not raw text scan only. | Ask with URL, then "quote the page"; assert second request fetches same URL without re-supplying it. |
| Memory and knowledge injection | Chat/orchestrate; Admin Knowledge; Settings memory | `/api/knowledge/*`, `/api/context/assess`, `/api/orchestrate` | `KnowledgeService`, `MemoryService`, `MemoryInjector`, `FoundationMemoryService`, `ChromaService` | yes | yes | partial | yes | `server/services/KnowledgeService.ts`, `server/services/MemoryInjector.ts`, `server/services/ChromaService.ts`, `server/routes-modules/knowledge.ts` | Chroma fallback is chronological file reads, not semantic similarity. Foundation memory only injected for admin/admin foundation flag. Memory can dominate answers if not validated by model. | Add retrieval trace, scores, source types, and whether memory changed final answer. Use real embeddings or mark fallback retrieval as chronological. | Create a project memory fact, ask related and unrelated questions, assert only related prompt receives it and response changes. |
| Voice and presentation governance | All orchestrate/chat responses | In-process post-processing | `ZedVoiceFormationEngine`, `ZedResponseGovernance` | yes | yes | partial | yes | `server/services/ZedVoiceFormationEngine.ts`, `server/services/ZedResponseGovernance.ts`, `server/routes-modules/orchestrate-and-misc.ts` | Masks upstream empty/template output by deriving a cleaner failure message; can hide execution failure details unless metadata/logs are checked. | Preserve `presentation.adjustments` and upstream failure reason in metadata. Do not strip evidence needed for debugging. | Force empty upstream response and assert user sees concrete failure plus server metadata records `derived_specific_no_output_response`. |
| Reflection/reasoning engines | Chat/orchestrate responses | In-process | `ZedReflectionEngine`, `ZedPrincipleEngine`, `ZedStrategicReasoningEngine`, `ContextInquiryEngine` | yes | yes | partial | yes | `server/routes-modules/orchestrate-and-misc.ts`, `server/orchestrator/ManagerAgent.ts`, `server/services/ZedReflectionEngine.ts`, `server/services/ZedPrincipleEngine.ts`, `server/services/ZedStrategicReasoningEngine.ts`, `server/services/knowledge-ingestion/ContextInquiryEngine.ts` | Principle/strategic engines only add prompt text. Reflection writes summaries after replies; it does not alter the current answer. Context inquiry can block with "I need one detail..." when graph uncertainty triggers. | Treat these as prompt-governance, not execution engines. Add tests proving strategic prompt affects outputs or downgrade naming. | Trigger strategic and non-strategic prompts; assert metadata includes active triggers and reflection storage decision. |
| Admin settings/users/security/logs | `/admin` | `/api/admin/*`, `/api/client-log` | Admin settings store, security audit, runtime logger | yes | yes | partial | yes for admin UI | `client/src/pages/admin.tsx`, `server/routes-modules/admin-settings.ts`, `server/routes-modules/admin-logs.ts`, `server/localAuth.ts` | Most admin surfaces are CRUD/status; some status probes require credentials. `/api/admin/system-test` is unauthenticated. | Protect `/api/admin/system-test` or rename as public health if intended. Add admin-route auth tests. | Anonymous GET to all `/api/admin/*` routes should be 401/403 except explicitly public login-email. |
| Authentication and users | `/login`, route guards | `/api/login`, `/api/logout`, `/api/admin/login/*`, `/api/me` | Local auth modules, sessions, managed users | yes | yes | partial | yes | `server/local-auth/routes-login.ts`, `server/local-auth/routes-admin-otp.ts`, `server/local-auth/middleware.ts`, `client/src/App.tsx` | Runtime depends on session secret/admin env/settings. Public admin email hint is intentionally exposed. | Add integration tests for normal user denied admin UI and admin API. Validate `SESSION_SECRET` before boot in production. | Login as non-admin, request `/api/admin/settings`, expect 403. |
| Workspaces/projects/history | `/workspace`, `/workspaces/:workspace`, `/projects/:id`, `/history` | `/api/projects`, `/api/conversations`, `/api/flows/runs` | Project filing store, conversation CRUD, flow store | yes | yes | partial | partial | `client/src/App.tsx`, `client/src/pages/workspace.tsx`, `client/src/pages/project-detail.tsx`, `server/routes-modules/projects.ts`, `server/services/ZedContextBuilder.ts` | Project instructions/sources only reach prompts when a conversation is assigned to project; selected workspace route does not automatically constrain chat context. | Include workspace/project id in chat dispatch payload and prompt context. | Assign conversation to project with instructions; ask related prompt; assert `buildZedAdminContext` includes project section. |
| Flows/runs/approvals | `/flows`, `/workspaces/:workspace/tools/:id`, `/history/:runId` | `/api/flows/*`, `/api/admin/flows/*` | `FlowStore`, `ZcosFlowEngine`, `FlowExecutor` | yes | yes | partial | partial | `server/routes-modules/flows.ts`, `server/services/FlowStore.ts`, `server/zcos/flows/ZcosFlowEngine.ts`, `server/services/flow/FlowExecutor.ts` | Flows execute model-stage prompts or local structured fallback. They do not call the same specialized agents/services as chat; stage agents are model prompt labels. | Wire stage execution to actual agents/tools by lane, or rename as "model workflow stages." | Run a published flow; assert each stage has output, provider/local executor event, approval handling, and final report. |
| Approval queue | Admin approvals, agent/flow approval gates | `/api/admin/approval-queue`, `/api/admin/approve/:id`, `/api/admin/reject/:id`, `/api/approval/*` | `AgentApprovalAdapter`, `ApprovalDecisionHandler`, `ExecutionApprovalHandler` | yes | yes | partial | yes for approval-required tasks | `server/routes-modules/approvals.ts`, `server/services/approval/*`, `server/services/execution/execution-routes/approval.ts` | Approvals record/decide tasks, but chat agents usually stop at draft/approval required and do not resume real provider action automatically. | Connect approval decision to dispatch/resume for the originating action. | Ask to send email, approve task, verify actual dispatch service is called or explicitly remains draft-only. |
| Trading workspace and finance routing | `/trading`, chat finance prompts | `/api/trading/*`, `/api/orchestrate` | `FinanceAgent`, `TradingStore`, scanner/thesis/governance engines | yes | yes | partial | partial | `client/src/pages/trading.tsx`, `server/routes-modules/trading.ts`, `server/agents/finance/FinanceAgent.ts`, `server/zcos/trading/*` | Trading UI can create simulation records. Chat finance requests analyze and read stores/search; chat does not call trading CRUD to create paper trades. No broker/live execution by design. | Add explicit chat-to-trading actions for "log paper trade" with field validation and approval-safe storage. | Chat "log this paper trade..." with required fields; assert `/api/trading/paper-trades` equivalent storage occurs or ZED asks for missing fields. |
| Email/calendar/external integrations | Admin Integrations, Inbox, intake endpoints, operations prompts | `/api/admin/settings/integrations`, `/api/inbox/email`, `/api/intake/*`, `/api/operational/orchestrate` | `EmailInboxService`, `MessagingBridge`, `DigitalExecutionService`, `GitHubIntegrationService`, `FirewallIntegrationService` | partial | partial | partial/untested | partial | `server/services/EmailInboxService.ts`, `server/services/intake/MessagingBridge.ts`, `server/services/execution/DigitalExecutionService.ts`, `server/services/ZedContextBuilder.ts` | Normal chat describes/drafts actions. `DigitalExecutionService` sends mock success unless env flags are set. Calendar is only draft payload via `SchedulingAssistant`, not provider send. | Replace mock success with explicit `mocked: true`; wire operations approval to real dispatch services. | Configure SMTP/Twilio test credentials, approve outbound action, assert provider API called and task outcome stored. |
| Runtime diagnostics/observability | Chat footer, admin provider cards, runtime logs | `/api/system/runtime`, `/api/admin/system-status`, `/api/admin/provider-diagnostics`, `/api/admin/logs` | `RuntimeLogger`, provider health, admin settings | yes | yes | partial | partial | `server/routes-modules/diagnostics.ts`, `server/services/RuntimeLogger.ts`, `client/src/components/chat/ChatRuntimeFooter.tsx` | Logs capture failures and routing events, but no per-request end-to-end trace ID across UI, route, agent, tools, provider, and response. | Add trace ID to each chat/orchestrate request and include service invocation spans. | Send one prompt and verify a single trace contains route, selected agent, retrieval, tool/fetch/search, model, presentation, persistence. |
| File upload/session processing | Chat file button | `/api/conversations/:id/upload`, `/api/conversations/:id/files` | Multer/file processor/storage | yes | partial | untested | partial | `client/src/components/chat/FileUpload.tsx`, `server/routes-modules/conversations-crud.ts`, `server/services/fileProcessor.ts` | Files are uploaded and listed, but primary `/api/orchestrate` does not automatically include uploaded file content unless route/context builder wires it elsewhere. | Inject current conversation file summaries into chat prompt or add explicit file analysis route. | Upload a text/PDF, ask about its contents, assert response quotes uploaded content. |

## Critical Defects

### DEF-001

- Severity: P0
- Feature: External action execution from chat
- Evidence: `OperationsAgent.process` generates model text and approval records; `DigitalExecutionService.sendEmail` returns mock success unless `EMAIL_PROVIDER_ENABLED=true`; normal chat route calls `ZedAutonomousOrchestrator.route` then `ManagerAgent.route`, not `ExecutionPipeline.dispatch`.
- Root Cause: Chat agents are not connected to execution dispatch/resume after approval.
- Impact: ZED can say it prepared or queued actions, but real-world actions are not performed through primary chat.
- Required Fix: Convert operation-intent outputs into structured task records, approval records, and dispatchable payloads. On approval, resume through `ExecutionPipeline.dispatch` or `ToolOrchestrationEngine` with real provider status.
- Verification Test: Ask "send this email to X"; verify task pending approval, approve it, then assert SMTP/Twilio/API provider call or explicit `mocked: true` refusal.

### DEF-002

- Severity: P0
- Feature: Template/fallback leakage and masking
- Evidence: `ZedAutonomousOrchestrator.appendFlowSuggestion` appends `Next move:`; `ZedVoiceFormationEngine` strips rejected/canned phrases and derives failure text from empty output; legacy `conversations-send.ts` passes `result.reply || "(no response)"` and `fullResponse || "(no response)"`.
- Root Cause: Presentation layer compensates for upstream failures/templates instead of forcing route-level failure states.
- Impact: Users may see cleaned but misleading output; debugging loses the original execution failure.
- Required Fix: Reject empty/template upstream outputs before presentation; store failure metadata; remove `Next move` appending from runtime path or make it structured metadata.
- Verification Test: Mock provider empty/template response; assert no assistant message is stored as normal content and response has explicit failure state.

### DEF-003

- Severity: P0
- Feature: Duplicate/shadow chat pipeline
- Evidence: Current `ChatArea` imports `sendAgentMessage`; `sendChatMessage` is unused; both `/api/orchestrate` and `/api/conversations/:id/messages` are registered and contain different routing logic.
- Root Cause: New orchestrate path was added without removing or converging the older SSE message route.
- Impact: Behavior depends on caller path. Fixes to one chat route may not affect the other.
- Required Fix: Make one authoritative chat route. Move streaming support into `/api/orchestrate` or route both endpoints through a shared handler.
- Verification Test: Static dependency check plus request parity tests for stream/non-stream prompts.

### DEF-004

- Severity: P1
- Feature: Research website traversal
- Evidence: `WebContentService.fetchWebTargetsFromText` fetches URLs present in text; no crawler/discovery for "blog page"; `IntelligenceAgent` asks for URL when no direct target exists.
- Root Cause: URL fetch exists; site navigation and page discovery do not.
- Impact: "Visit this website and quote the blog page" will fetch the supplied site URL, but it will not reliably discover `/blog` or quote a linked blog page.
- Required Fix: Add bounded same-origin discovery for requested page types (`blog`, `about`, `pricing`, etc.) with source capture.
- Verification Test: Use a fixture site with homepage linking `/blog`; prompt for blog quote; assert `/blog` is fetched and quoted.

### DEF-005

- Severity: P1
- Feature: Flow execution claims
- Evidence: `ZcosFlowEngine.runStage` calls `executeProviderChat` with stage prompts; local fallback produces structured text; it does not call `IntelligenceAgent.research`, `FinanceAgent.process`, or integration clients.
- Root Cause: Stage `assignedAgent` is a prompt/persona lane, not an execution dispatch binding.
- Impact: Flows execute as model workflows, not real multi-agent/tool workflows.
- Required Fix: Add agent/tool adapters per `assignedAgent` and per step type.
- Verification Test: A research stage must call `IntelligenceAgent.research` and record direct fetch/search metadata, not just model text.

### DEF-006

- Severity: P1
- Feature: Memory retrieval proof
- Evidence: `KnowledgeService.buildContext` injects memory into prompts; `ChromaService` falls back to file reads sorted by filename when Chroma is offline.
- Root Cause: Retrieval trace is not returned to chat response metadata; fallback retrieval is not similarity retrieval.
- Impact: Cannot prove retrieved memory changed the answer; stale/random recent memories may be injected.
- Required Fix: Add retrieval trace and relevance scores to request metadata; label fallback as chronological.
- Verification Test: With Chroma offline, assert response metadata says `vector_mode=filesystem_chronological`.

### DEF-007

- Severity: P1
- Feature: Admin diagnostics exposure
- Evidence: `GET /api/admin/system-test` in `orchestrate-and-misc.ts` has no `isAdmin` guard.
- Root Cause: Debug route is under `/api/admin/*` but public.
- Impact: Public route can reveal active provider target and database status.
- Required Fix: Add `isAdmin`, or move to `/health/runtime-public` and reduce payload.
- Verification Test: Anonymous request returns 401/403.

## Feature-by-Feature Audit

### 1. Chat Pipeline

Status: PARTIAL.

Expected primary path:

`Chat UI -> send message -> route -> intent detection -> ManagerAgent -> selected agent/service/tool -> reasoning -> response`

Actual primary path:

`client/src/pages/chat.tsx -> ChatArea.handleSend -> sendAgentMessage -> POST /api/orchestrate -> ContextInquiryEngine optional block -> KnowledgeService/MemoryInjector/ZedContextBuilder prompt context -> ZedAutonomousOrchestrator.route -> ManagerAgent.route -> selected agent -> presentZedResponseWithChecks -> store assistant message`

The active UI path is not streaming. `sendAgentMessage` sets local optimistic messages after a JSON response. The registered SSE route in `conversations-send.ts` is shadowed by the current UI.

Execution bypasses:

- `/api/chat` is an unauthenticated single-shot legacy route and directly calls `generateFromOllama`.
- `/api/conversations/:id/messages` is registered and can bypass `ZedAutonomousOrchestrator`; it calls `ManagerAgent` only for web lookup, otherwise direct model lane.
- Active `/api/orchestrate` does call `ManagerAgent`, so the main UI is not completely bypassing orchestration.

Failure modes:

- `sendAgentMessage` shows `data?.reply || data?.error || "No response"`.
- `/api/orchestrate` catches errors and returns 200 JSON with `error: "Orchestration failed"` and a fallback reply.
- Legacy SSE uses `(no response)` placeholders.

Required fix:

- Collapse chat routes into a shared execution handler.
- Add streaming support to `/api/orchestrate` or remove the legacy SSE path.
- Replace `"No response"` and `(no response)` with typed failure responses.

### 2. ManagerAgent / Orchestration

Status: PARTIAL.

Actual:

- `ZedAutonomousOrchestrator.route` ignores legacy `targetAgent`, calls `ManagerAgent.route`, and concurrently computes a flow recommendation.
- `ManagerAgent.route` loads hub config, builds knowledge prompt, selects an agent, calls selected agent, and applies response presentation.
- Selected agents are actually called.

Limit:

- Agent outputs affect final response, but most agents are text generators, not tool executors.
- Agent selection has duplicate web-intent logic in `conversations-send.ts` and `manager-agent/agent-selection.ts`.
- Classifier fallback is keyword-based and logged, but response does not expose trace metadata.

Required fix:

- Return or log route trace with classifier result, fallback reason, target agent, and downstream service calls.
- Delete duplicate web-intent detector from legacy route.

### 3. Research / Web

Status: PARTIAL.

Actual:

- URL extraction and direct fetch work through `WebContentService`.
- Search works only if `BRAVE_SEARCH_API_KEY` or `SERPER_API_KEY` is visible.
- Page parsing is simple HTML-to-text. No DOM-aware extraction, no JavaScript rendering, no crawling.
- Prior webpage reference resolution scans recent raw message text for URLs.

Required fix:

- Add same-origin discovery for common page targets.
- Add source metadata to assistant messages.
- Make no-search-key state visible to response metadata and admin diagnostics.

### 4. Memory / Knowledge

Status: PARTIAL.

Actual:

- `KnowledgeService.buildContext` is invoked in `/api/orchestrate` and `ManagerAgent.route`.
- Project memory, scratchpad, core memory, ruleset memory, foundation memory, and vector/fallback memory can enter prompts.
- `KnowledgeService.persistInteraction` is called in legacy conversation send, not in the active `/api/orchestrate` path. Active path relies on reflection and agent-specific memory writes, not the same episodic/semantic persistence.

Failure mode:

- Memory can be echoed because it is prompt text, not structured evidence with validation.
- Chroma fallback is not semantic retrieval.

Required fix:

- Call `KnowledgeService.persistInteraction` from `/api/orchestrate`.
- Include retrieval trace in metadata.
- Distinguish current, historical, candidate, superseded, and external facts in prompt and metadata.

### 5. Voice / Presentation

Status: PARTIAL.

Actual:

- `ZedVoiceFormationEngine` is invoked across chat/orchestrate/ManagerAgent.
- It removes internal leakage, rejected phrases, canned headings, and empty output placeholders.
- It can derive a specific failure message when output is empty.

Risk:

- Presentation governance can make a broken upstream route look coherent.
- Adjustment metadata is not returned to the user or stored in assistant message metadata in the primary path.

Required fix:

- Store presentation checks/adjustments with assistant metadata.
- Fail fast on empty/model-template output before presentation.

### 6. Reflection / Reasoning

Status: PARTIAL.

Actual:

- Strategic and principle engines are prompt builders.
- Reflection writes project memory after selected replies when it considers the exchange operationally relevant.
- Context inquiry can stop a request and ask one question before agent dispatch.

Failure mode:

- These are named "engines" but mostly do prompt/context shaping. They do not execute independent reasoning beyond deterministic trigger logic.

Required fix:

- Rename or document them as governance/prompt engines unless outputs are separately evaluated and used.
- Add metadata for active triggers and reflection storage result.

### 7. Admin

Status: PARTIAL.

Actual:

- Admin UI routes exist and are gated on frontend by `isAdmin`.
- Backend admin settings, users, logs, security log, env validator, ruleset, flows, knowledge, approvals are mostly protected by `isAdmin`.
- Add Test User is backed by `POST /api/admin/users`.

Failure mode:

- `/api/admin/system-test` is public.
- Admin pages mostly configure data; many settings only become prompt context, not real capabilities.

Required fix:

- Add backend auth tests for all admin routes.
- Protect or move `/api/admin/system-test`.

### 8. Authentication / Users

Status: PARTIAL.

Actual:

- Local username/password and admin secure phrase flow exist.
- Admin OTP email flow exists and can send via SMTP or log fallback.
- Sessions drive `isAuthenticated` and `isAdmin`.

Unverified:

- Runtime cookie security depends on settings/env.
- Full login route behavior requires runtime session setup and credentials.

Required fix:

- Add integration tests for login, non-admin denial, admin approval access, logout, and session expiry.

### 9. Workspaces / Projects / History

Status: PARTIAL.

Actual:

- Frontend routes exist for workspace, project details, history, flow runs.
- Project CRUD and assignment routes exist.
- Project instructions/sources are injected only when conversation is assigned to a project.

Failure mode:

- Workspace route selection is not automatically sent with chat dispatch.
- Uploaded/attached project sources are prompt context, not necessarily fetched or parsed live.

Required fix:

- Send workspace/project context in chat payload and store it in conversation metadata.

### 10. Flows / Runs / Approvals

Status: PARTIAL.

Actual:

- Flow CRUD, publish/archive/duplicate, user runs, retry/resume/cancel, approval gates exist.
- Flow execution writes run state and reports.

Failure mode:

- Stage execution is provider chat or local fallback, not actual service/agent execution.
- Flow recommendation from chat is appended text, not an executable launch.

Required fix:

- Add "launch recommended flow" action metadata and UI control.
- Dispatch flow stages to real agent/tool adapters.

### 11. Trading

Status: PARTIAL.

Actual:

- Trading workspace routes and CRUD exist.
- Scanner/thesis/governance/paper-trade simulation exist.
- FinanceAgent uses web search, trading knowledge, performance, and prior research.

Failure mode:

- Chat finance route does not create trading records.
- No live broker integration by design.

Required fix:

- Add chat action adapters for creating thesis/paper trade after field validation.

### 12. Email / Calendar / External Integrations

Status: PARTIAL.

Actual:

- Admin can configure integration settings.
- GitHub and firewall status probes make real calls when configured.
- Gmail inbox can read via Google API if configured.
- MessagingBridge can send Telegram/Discord/Slack/Twilio when credentials exist.
- `DigitalExecutionService` can mock email/form/API and live API call when env flags are set.

Failure mode:

- Operations chat does not use these services to perform actions.
- Calendar is draft-only through `SchedulingAssistant`; no calendar provider send route is implemented.

Required fix:

- Wire approved operation tasks into provider services.
- Replace mock success with explicit mock result status.

### 13. Runtime Diagnostics

Status: PARTIAL.

Actual:

- Runtime status and provider diagnostics exist.
- Runtime logger records HTTP errors and selected service events.

Failure mode:

- No single trace ID spans UI request through agent, retrieval, tool, provider, presentation, persistence.

Required fix:

- Introduce execution trace records for every `/api/orchestrate` request.

### 14. Dead / Shadowed / Decorative Systems

Status: FAIL/PARTIAL depending system.

Dead or shadowed:

- `client/src/components/chat/chat-area/sendChatMessage.ts`: unused by current chat UI.
- `POST /api/conversations/:id/messages`: registered but shadowed by `/api/orchestrate` in primary UI.
- `client/src/components/social/SocialFeed.tsx`: exported but no active import found.
- `server/services/workflow/ExternalContextBridge.ts`: placeholder by file comment and returned messages.
- `server/services/flow/FlowExecutor.ts`: service exists but route execution uses `server/zcos/flows/ZcosFlowEngine.ts`; no route import found for this older executor.

Decorative or mostly prompt-only:

- `ZedPrincipleEngine`: prompt builder.
- `ZedStrategicReasoningEngine`: deterministic trigger/prompt builder.
- `ZedResponseGovernance`: sanitizer/prompt builder.
- Flow `assignedAgent` labels: model prompts, not actual agent dispatch.

## Execution Bypass Findings

1. `/api/chat` bypasses auth, conversations, memory persistence, `ManagerAgent`, and ZCOS.
2. Legacy `/api/conversations/:id/messages` bypasses `ZedAutonomousOrchestrator` and only uses `ManagerAgent` for web lookup.
3. Flow stages bypass actual agent classes and call provider chat directly.
4. Operations/business/finance agents bypass execution services and only draft/plan/register approvals.
5. Admin integration settings are injected into prompts, but prompt visibility is not the same as service invocation.

## Template / Placeholder Leakage

Active or user-reaching:

- `server/zcos/orchestration/ZedAutonomousOrchestrator.ts`: appends `Next move: I can turn this into an executable ZED action...`; presentation strips the label but keeps generic suggestion body. Replace with structured `flowRecommendation` metadata and UI affordance.
- `client/src/components/chat/chat-area/sendAgentMessage.ts`: `data?.reply || data?.error || "No response"` can reach users on empty response. Replace with typed error handling.
- `server/routes-modules/orchestrate-and-misc.ts`: fallback reply "ZED's model host is not reachable..." reaches users on `/api/chat` failure. Acceptable only if paired with provider diagnostics.

Shadowed or non-primary but still registered:

- `server/routes-modules/conversations-send.ts`: `result.reply || "(no response)"`, `fullResponse || "(no response)"`, and direct model-host fallback.

Internal/sanitizer patterns:

- `ZedVoiceFormationEngine`, `ZedResponseGovernance`, and `manager-agent/format.ts` contain many rejected heading/template strings. These are mostly sanitizers, not leakage by themselves.

## Immediate Fix Queue

### P0

1. Unify chat routes: route current UI, SSE, and legacy chat through one shared orchestrate handler.
2. Add execution trace IDs and metadata to `/api/orchestrate`.
3. Replace empty/template response fallbacks with typed route-level failure states.
4. Wire approved operations to real dispatch or explicitly mark them draft-only.
5. Protect `/api/admin/system-test`.

### P1

1. Add research source metadata and bounded page discovery.
2. Persist interactions from active `/api/orchestrate` into episodic/semantic memory.
3. Wire flow stages to actual agent/tool adapters.
4. Add chat actions for trading record creation.
5. Return presentation adjustments and retrieval trace in metadata.

### P2

1. Remove unused `sendChatMessage` or re-enable it intentionally.
2. Remove or reclassify placeholder systems.
3. Add static dead-code checks for services/components with no imports.
4. Add admin settings preview showing which settings are prompt-only versus executable.

## Verification Plan

Run after fixes:

1. Chat normal request:
   - POST through UI to `/api/orchestrate`.
   - Assert stored user and assistant messages.
   - Assert trace includes ManagerAgent, selected agent, provider, presentation, persistence.

2. Web direct URL:
   - Prompt with a fixture URL.
   - Assert `WebContentService.fetchWebTargetsFromText` fetched content and sources are stored.

3. Web follow-up:
   - Prompt with URL, then "quote that page."
   - Assert URL resolves from conversation metadata, not raw text only.

4. Blog discovery:
   - Fixture homepage links `/blog`.
   - Prompt "visit this website and quote the blog page."
   - Assert `/blog` fetch and quote.

5. Empty provider:
   - Mock provider returns empty string.
   - Assert typed failure and no normal assistant message with `(no response)` or "No response".

6. Operations email:
   - Prompt "send email..."
   - Assert task and approval record created.
   - Approve.
   - Assert dispatch called with either real provider result or explicit `mocked: true`.

7. Memory relevance:
   - Add project memory.
   - Ask related/unrelated prompts.
   - Assert retrieval trace and answer changes only when relevant.

8. Flow execution:
   - Run a published flow.
   - Assert each stage records whether it used actual agent/tool/provider/local fallback.

9. Trading chat:
   - Ask to log a paper trade with complete fields.
   - Assert trading store record is created or ZED returns field-specific missing info.

10. Admin auth:
   - Anonymous and normal user requests to all `/api/admin/*`.
   - Assert 401/403 except intentional public endpoints.

## Files Requiring Immediate Changes

- `client/src/components/chat/chat-area/sendAgentMessage.ts`
- `client/src/components/chat/chat-area/sendChatMessage.ts`
- `server/routes-modules/orchestrate-and-misc.ts`
- `server/routes-modules/conversations-send.ts`
- `server/zcos/orchestration/ZedAutonomousOrchestrator.ts`
- `server/orchestrator/ManagerAgent.ts`
- `server/orchestrator/manager-agent/agent-selection.ts`
- `server/services/ZedVoiceFormationEngine.ts`
- `server/services/KnowledgeService.ts`
- `server/services/ChromaService.ts`
- `server/zcos/flows/ZcosFlowEngine.ts`
- `server/services/execution/ExecutionPipeline.ts`
- `server/services/execution/DigitalExecutionService.ts`
- `server/agents/operations/OperationsAgent.ts`
- `server/agents/business-manager/BusinessManagerAgent.ts`
- `server/agents/finance/FinanceAgent.ts`
- `server/agents/intelligence/IntelligenceAgent.ts`
- `server/services/WebContentService.ts`
- `server/services/WebSearchService.ts`

