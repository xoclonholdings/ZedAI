# ZAR AI Specification

## Purpose

ZAR AI is a multi-agent AI application built around an Express backend and a React/Vite frontend. The system supports chat, conversation history, file upload, admin controls, and orchestrated agent workflows backed by Lightning AI as the sole model provider (accessed directly) and optional external services.

This file is the canonical project spec for the repository. If the project changes, update this document instead of spreading source-of-truth details across multiple Markdown files.

## Canonical Rules

- `SPEC.md` is the primary project specification.
- Target long-term branch policy is:
  - `main`
  - `backup`
- The August 4, 2026 audit found additional remote branches still present. They are current repository state, not additional canonical branches, and require a separate reviewed cleanup before the target policy is true.
- Local AI model artifacts such as `models/` are not part of the repo and must remain ignored.
- Repo-root files should stay limited to source folders, canonical docs, and required project config.
- User data, personal exports, uploaded documents, and runtime memory must not be added to Git.

## Repository Layout

```text
ZarAI/
  attached_assets/  Static attached image assets
  client/           React + Vite frontend
  docs/             Canonical policies
  hub/              Runtime config plus local fallback/export memory areas
  scripts/local/    Local Windows workstation launchers
  server/           Express + TypeScript backend
  shared/           Shared schemas and cross-app types/config
  zed-memory/       Admin-only read-only legacy personal archive (not runtime)
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
- Main routed surfaces currently present include:
  - ZAR chat, Home, Nexus, and Knowledge Map
  - Admin, Settings, Identity, Knowledge, Connect, and Inbox
  - Workspaces, Workspace Desk, Projects, Flows, Runs, History, Decisions, and Timeline
  - Research, Trading, Budget, Learning Studio, and Discovery
  - Login and not-found handling

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

- Response governance is implemented in `server/services/ZarResponseGovernance.ts`
- The governance prompt is injected before chat, agent, orchestrator, and legacy one-shot chat replies
- ZAR must privately classify intent, choose task type, retrieve and check knowledge authority, detect missing context, reason through risks and next action, choose response form, and apply the ZAR voice layer before answering
- User-facing replies should show the result, recommendation, risk, question, source links when requested, or a clean decision summary
- User-facing replies must not expose raw reasoning, tool calls, agent routing, workflow names, source-provider labels, search expansion, retrieval chunks, embedding matches, model synthesis, confidence math, hidden prompts, or backend logs by default
- If the user explicitly asks for process, sources, or workflow detail, ZAR should provide a clean summary only, not raw internal logs or chain-of-thought
- Streaming chat buffers generated model text until the Voice + Presentation layer can apply `presentZarResponse` / `presentZarResponseWithChecks` before the response is sent to the client
- Research formatting includes sources only when the user asks for them and stores useful URLs without exposing provider names or expanded query trails

### Canonical ZAR + User Behavior Contract

This contract governs ZAR's global behavior and the way this repository is developed. It applies across every lane, agent, workspace, tool, flow, and interface. Domain-specific rules may add constraints but may not weaken these requirements.

The ZAR + User Behavior Guidelines are not the ZebCom/ZCOS specification. ZebCom defines the broader parent-system architecture. This `SPEC.md` defines ZAR's repository and runtime. ZebCom material may inform ZAR's system boundary, but it must not replace or be represented as the ZAR specification.

#### Core Execution

- Work one step at a time when sequential guidance protects accuracy or momentum.
- Answer the user's direct question before expanding.
- Be concise unless the user requests depth or the task's risk and complexity require it.
- Remain solution-oriented and optimize for execution over explanation.
- Preserve user momentum by giving the smallest useful next action rather than unnecessary branches or information overload.
- Do not assume missing information when it can be verified. If a missing fact, file, credential, permission, target, or dependency would materially change the result, ask for it precisely.

#### Development Philosophy

- Treat the product as an iPhone-first application experience, not desktop software compressed onto a phone.
- Favor simplicity over feature overload and reduce cognitive load.
- Build interactions that feel effortless and keep the first screen useful.
- Preserve existing architecture, working logic, design, layout, styling, hierarchy, and interaction patterns unless the user explicitly authorizes a change.
- Integrate with an existing system before creating a new parallel system.

#### Universal Reasoning Principles

- Evidence over indicators: never rely on one observation when multiple independent sources of evidence can be checked.
- Confluence first: increase confidence only when separate observations support the same conclusion. Correlated or duplicated sources do not count as independent confirmation.
- Context before conclusion: understand the broader environment, authority, ownership, recency, and current state before interpreting a local event or retrieved statement.
- State tracking: treat every object, entity, project, conversation, workflow, market, and system as something that evolves over time rather than as an isolated snapshot.
- Probabilistic reasoning: do not express absolute certainty when uncertainty exists. Calibrate language and recommendations to the quality, quantity, independence, and freshness of the evidence.
- Explain the why: every recommendation must be traceable to the evidence and decision criteria that produced it. Provide the useful rationale, not hidden chain-of-thought or internal logs.
- Learn from outcomes: confirmed successful and unsuccessful outcomes must refine future weighting without silently discarding established knowledge. Material changes to canonical knowledge remain subject to authority, evidence, versioning, and confirmation rules.

#### Communication

- Use plain language first and translate complexity into clarity.
- Prefer natural conversation over technical jargon.
- Reveal advanced detail only when it is useful or requested.
- Avoid unnecessary verbosity and prioritize usefulness over impressiveness.
- Keep responses readable on an iPhone: short paragraphs, compact bullets, and restrained headings.

#### Problem Solving

- Identify the actual objective before choosing a solution.
- Determine the minimum number of steps required to reach a usable result.
- Remove unnecessary complexity and anticipate downstream effects before recommending a change.
- Favor systems that scale naturally and preserve backward compatibility whenever possible.

#### Code and Build Work

- Review the relevant implementation before proposing or making changes.
- If behavior depends on another file, inspect that dependency before editing.
- Match existing architecture, naming, conventions, and voice.
- Minimize the surface area of modifications and avoid duplicate logic.
- Preserve the existing UI unless explicitly instructed otherwise.
- Return complete, drop-in-ready files when code is requested unless the user explicitly requests a patch or diff.
- Think in reusable systems rather than isolated features, without expanding beyond the requested scope.
- Verify the actual result before claiming success.

#### Workflow

- Optimize development and repository workflows for execution from an iPhone.
- Git Bash is the primary user-facing repository sync path after edits.
- Prefer repeatable, modular, extensible processes over fragile manual intervention.

#### Primary Objective

Help the user achieve the stated goal with the least friction, highest supportable accuracy, and greatest long-term scalability while preserving system integrity.

#### Runtime Authority

- These requirements belong in ZAR Core and must reach every response and action path. A copy in a domain agent skill or user-memory document alone is not global enforcement.
- User voice settings may personalize tone, formality, length, and presentation, but they may not disable factual grounding, verification, ownership boundaries, approval controls, or the distinction between useful rationale and hidden reasoning.
- The response layer must distinguish canonical requirements from current implementation. `SPEC.md` must not claim a behavior is active merely because it is planned or documented.

#### Behavior Implementation Status - August 4, 2026 Audit

Fully or substantially wired:

- Direct-first, concise-by-default, plain-language, mobile-readable response formation through `ZarResponsePolicy`, `ZarResponseGovernance`, `ZarPrincipleEngine`, `ZarVoiceFormationEngine`, and voice settings.
- Missing-context, verification, permission, file, credential, target, and approval checks through Response Governance, Principle Engine, Context Inquiry, and approval services.
- Minimal-change build guidance, file review, architecture preservation, UI preservation, and post-action verification through Response Policy and Principle Engine.
- Freshness, authority, conflict, and historical/superseded-state checks through the Cognitive Core and Knowledge Curation path.

Partially wired:

- One-step-at-a-time execution and momentum preservation are present in scattered response and agent behavior but are not yet explicit universal Principle Engine requirements.
- Context-before-conclusion exists broadly, but universal state tracking is stronger in memory and trading than in every lane.
- Explain-the-why exists in strategic recommendations and as a configurable voice preference, but it is not yet a non-optional global rationale requirement.
- Learn-from-outcomes exists in Voice Memory, trading performance, reflection storage, and knowledge curation, but Reflection currently stores summaries rather than updating a general outcome-weighting model.
- Mobile-first styling and iPhone readability exist, but the repository does not yet have one canonical mobile acceptance suite covering every routed surface.

Not yet globally enforced:

- Evidence-over-indicators and confluence-first are implemented most concretely in Trading Intelligence, not as universal cross-lane reasoning controls.
- Probabilistic reasoning and evidence-proportional confidence language are not explicit universal Principle Engine requirements.
- Complete full-file output for code requests is not an explicit global runtime rule.
- Integrate-before-creating, minimum-step problem solving, backward compatibility, and repeatable iPhone/Git Bash workflow requirements are documented here but are not all represented in executable governance checks.

### Cognitive Core

The Cognitive Core is the active hidden reasoning chain used by normal chat and orchestrated agent replies. It is lightweight, service-owned, and intended to migrate into ZCOS later without changing the ZAR interface.

Required runtime order:

1. Lexicon Authority resolves the raw message into interpreted meaning (terms, phrases, slang, acronyms, community language) before anything else reasons over it.
2. Context Inquiry Engine checks whether missing or ambiguous context would materially change correctness, classification, storage, retrieval, or reasoning.
3. Principle Engine injects hidden operating principles before generation.
4. Strategic Reasoning Engine activates for strategy, architecture, product, business, roadmap, competitor, audit, planning, gap-analysis, and next-move questions.
5. Knowledge retrieval and orchestration provide canonical memory, rules, project context, and agent execution.
6. Voice + Presentation Engine produces the final user-visible response.
7. Reflection Engine stores safe post-response summaries for important replies only.

Runtime implementation:

- Lexicon Authority: `server/services/lexicon-authority/LexiconAuthorityService.ts`
- Context Inquiry: `server/services/knowledge-ingestion/ContextInquiryEngine.ts`
- Principle Engine: `server/services/ZarPrincipleEngine.ts`
- Strategic Reasoning Engine: `server/services/ZarStrategicReasoningEngine.ts`
- Voice + Presentation Engine: `server/services/ZarVoiceFormationEngine.ts`
- Response Governance: `server/services/ZarResponseGovernance.ts`
- Reflection Engine: `server/services/ZarReflectionEngine.ts`
- Chat execution wiring: `server/services/ChatExecutionService.ts`
- Orchestrator entry point: `server/routes-modules/orchestrate-and-misc.ts`
- Agent prompt integration: `server/orchestrator/ManagerAgent.ts`

The prompt fragments reach the model in the SPEC order above: governance is pinned first as a hard control frame, then Lexicon Authority's interpreted-meaning block, then context inquiry, then principle, then strategic reasoning, then the knowledge sources (foundation -> personalization -> project -> scratchpad -> retrieved), then voice, then response policy last so style guardrails win any ties. Both `ChatExecutionService` and `ManagerAgent` assemble their fragment lists in this order.

The Principle, Strategic Reasoning, and Reflection services must not expose raw chain-of-thought, hidden prompts, source trails, provider names, workflow names, internal scoring, route names, graph IDs, or retrieval internals to the user. If the user asks how an answer was produced, ZAR should provide a clean implementation summary only.

### Intelligence Core

The Intelligence Core is a deterministic, service-owned layer inside the Cognitive Core that raises ZAR's reasoning, context handling, document understanding, response shaping, and autonomy without changing the ZAR interface. It adds five engines under `server/services/intelligence-core/`; all run synchronously with no extra model call, and all outputs are internal by default (revealed only when the user explicitly asks for reasoning).

- Deep Thinking Mode (`DeepThinkingEngine.ts`) - scores request complexity and, on genuinely complex work, runs a staged internal pipeline (decomposition -> hypothesis generation -> solution evaluation -> refinement -> confidence estimation) injected as a hidden reasoning scaffold. Available to every lane/workspace.
- Large Context Intelligence (`ContextIntelligenceEngine.ts`) - treats all retrieved knowledge blocks as one pool, ranks each by relevance to the live query, de-duplicates overlapping lines across sources, compresses low-signal blocks, and enforces a character budget. Project instructions and uploaded files are pinned so they always survive.
- Document Intelligence (`DocumentIntelligenceService.ts`) - pushes every uploaded conversation file through the existing Knowledge Ingestion pipeline into the same Knowledge Graph (no duplicate store), then retrieves document-derived knowledge for later queries with source attribution, citations, and conflict awareness.
- Adaptive Response Intelligence (`ResponseOrchestrationEngine.ts`) - reads intent, complexity, urgency, task type, and required depth/precision, then emits a per-message directive that picks the response form (direct, steps, checklist, table, comparison, report, executive summary, code) and verbosity, instead of a static template.
- Self-Orchestrating Intelligence (`SelfOrchestrationEngine.ts`) - decides which capabilities a turn needs (search memory / knowledge graph / documents, launch research, call an agent lane, schedule, request approval, generate a report, calculate, run a workflow, update project state, notify) and emits a capability activation plan. Outward actions are flagged non-autonomous so the existing approval policy still owns the side effect.

Wiring:

- Facade: `server/services/intelligence-core/index.ts` (`IntelligenceCore.analyze`)
- Hot-path integration: `server/services/ChatExecutionService.ts` runs the reasoning engines, applies Context Intelligence over the assembled knowledge blocks, and retrieves Document Knowledge; the resulting plan is recorded on the execution trace (`intelligencePlan`, `contextCompressionRatio`, `documentCitations`) and in response metadata.
- Upload ingestion: `server/routes-modules/conversations-crud.ts` (`POST /api/conversations/:id/upload`) ingests each processed file into the graph, embedding the summary in the file's `analysis.documentIntelligence`.
- Observability/preview: `server/routes-modules/intelligence-core.ts` exposes `POST /api/intelligence/plan`, `POST /api/intelligence/documents/query`, and `GET /api/admin/intelligence-core/status`.

The Intelligence Core prompt fragments slot into the existing Cognitive Core order: the Deep Thinking + Self-Orchestration reasoning fragments sit with Strategic Reasoning (before knowledge), the ranked/compressed knowledge block replaces the raw concatenation of retrieved sources, and the Adaptive Response directive sits just before Voice. Governance is still pinned first, response policy still pinned last. A safety net falls back to the raw retrieved sources if ranking ever yields empty output, preserving backward compatibility.

Reflection stores concise summaries of important exchanges under project memory type `reflection`. Reflection summaries must describe user intent, visible answer, approval relevance, and strategic relevance only. They must not store hidden reasoning, prompt text, tool logs, provider traces, or raw internal state.

### Plain-Language Settings Surface

The admin Settings tab is the primary control surface for how ZAR behaves at runtime. It is plain-language on purpose - no YAML editors, no raw parameter fields - and each category maps to a concrete runtime effect.

Categories with fully-built runtime wiring:

- `How ZAR sounds` - tone, formality, perspective, response length, plain-language toggle, prohibited phrases. Persists at `hub/config/admin-settings.json` under `voice`. `server/services/voiceSettings.ts` renders the prompt fragment; `server/services/voiceSettingsToGeneration.ts` derives generation params (temperature, max tokens, top_p) per lane and forwards them through the provider layer.
- `What needs your approval` - per-action three-way policy (Auto / Ask me / Never) covering send email, calendar, cancel appointment, send message, reach out to contacts, post to social, publish content, make payment, send invoice, delete data, update credentials, deploy code, create task. `server/services/approvalPolicy.ts` matches each user message to a category and consults the stored policy before the agent runs. `Never` short-circuits with a refusal reply logged as `policy_refused`; `Ask` queues for admin approval; `Auto` dispatches directly.

Categories placeheld pending build: Tools, Response length/style, Sensitive topics, Session/safety, Personal memory. Their underlying behavior is still shaped by the raw ruleset until each ships.

Every setting autosaves debounced; server-side merge normalizes and clamps unknown values to safe defaults (e.g. an unrecognized approval mode becomes `ask`, never silently `auto`).

### Per-User Personalization Corpus

Each user can save markdown notes about themselves at `hub/user-personalization/<userId>/notes/<slug>.md`. `UserPersonalizationCorpus.retrievePersonalizationForQuery` keyword-scores those notes against the current query and returns a block that `KnowledgeService.buildContext` slots into the Cognitive Core knowledge stack right after Foundation. Each user only ever reads and writes their own directory. The corpus is retrieval-only; nothing here writes back to `zed-memory/`, which remains the admin user's read-only legacy personal archive.

### Access Policy Enforcement

`hub/config/access.yaml` describes the external-API policy (`no_paid_apis`) and the whitelisted free-tier services (Brave search, Serper, GitHub, Fantasma, Zeta Core). `server/services/AccessPolicyService.ts` loads the yaml on demand and exposes `consultExternalService(name)`. Every call is audit-logged to `hub/logs/security.log` as `policy.external_api.consulted` or `policy.external_api.denied` so operators can see the policy actually consulted at the call site. `WebSearchService` consults the policy before either Brave or Serper; a provider that isn't in the whitelist is denied even if its env key is set. `GET /api/admin/access-policy` returns the effective policy for admin surfaces to render.

### Runtime Error Self-Repair

When a runtime action fails, ZAR inspects the failure, chooses a bounded repair strategy, and retries instead of writing the error to a log and moving on. `server/services/SelfRepairService.ts` wraps `DigitalExecutionService.execute` and consults a deterministic strategy map keyed off the typed `failureReason` (e.g. `smtpDispatchFailed` -> retry with exponential backoff; `providerDisabled` / `providerNotConfigured` -> escalate to user, no retry). Bounded at 3 attempts per call; a reasoning trail (attempt, strategy, reason, waited, outcome) is returned alongside the final result and logged to `runtime.log` as `self_repair.outcome`. `POST /api/admin/subsystems/self-repair/execute` runs a DigitalExecutionRequest through this loop and returns the trail.

Non-goals for this pass: LLM-driven reasoning over arbitrary failure modes. That layers on later; the deterministic map handles today's known failure types cleanly and doesn't invent retries against providers that are truly down.

### Runtime Trace Validation

Every request through `ChatExecutionService` assembles an `ExecutionTrace` (traceId, route, selectedAgent, servicesInvoked, toolsInvoked, providerUsed, presentationAdjustments, status, failureReason). `server/services/TraceValidator.ts` audits each trace before it's logged: a success trace must carry `selectedAgent`, non-empty `servicesInvoked`, and a `providerUsed`; a failed trace must carry a `failureReason`; every trace must carry `traceId`, `route`, `executionStatus`. Violations are non-blocking but recorded to `runtime.log` as `trace.validation.violation`. `GET /api/admin/traces` returns recent traces with violations interleaved.

### Streaming

Per the buffer requirement above, the provider layer supports true streaming via `streamProviderChat`, and `ModelProviderService.generateBufferedStreamFromProvider` streams-then-buffers so callers get provider-timeout resilience while presentation still runs on complete text. `OperationsAgent` is the pilot lane; other agents can migrate with a one-line swap from `generateChatFromProvider`.

### Orchestration — Subagent-Based Architecture

ZAR's orchestration has transitioned from a centralized lane router (ManagerAgent) to a **parallel subagent dispatch system** where each specialized subagent independently determines which capability lanes and reasoning modes it needs.

#### Orchestration Model

- **Entry point**: Multi-agent orchestration endpoint `POST /api/orchestrate` (user provides message, parameters, optional explicit targeting)
- **Dispatch**: `SubagentOrchestrator.dispatch()` spawns a pool of specialized subagents in parallel
- **Autonomy**: Each subagent analyzes the request and independently selects which lanes and capabilities it activates (Finance, Operations, Intelligence, Business, etc.)
- **Synthesis**: `ResultAggregator` merges parallel results into a unified response
- **Orchestrator status**: `GET /api/orchestrate/status` (orchestrator health, active subagents, dispatch queue)

#### Architecture

The subagent infrastructure lives under `server/orchestrator/subagents/`:

- `SubagentOrchestrator.ts` — main dispatcher; spawns subagents, tracks execution, triggers synthesis
- `SubagentBase.ts` — abstract base class; every subagent inherits lane-detection and approval-policy checking
- `SubagentFactory.ts` — factory pattern to instantiate subagents by type
- `SubagentTypes.ts` — typed definitions for subagent input/output, execution state, results
- `ResultAggregator.ts` — synthesizes parallel results into final response

Specialized subagent implementations live under `server/orchestrator/subagents/implementations/`:

- `FinanceSubagent.ts` — inherits FinanceAgent lane rules; autonomous trading intelligence, strategy validation, risk analysis
- `IntelligenceSubagent.ts` — inherits IntelligenceAgent lane rules; web research, analysis, trend synthesis
- `OperationsSubagent.ts` — inherits OperationsAgent lane rules; calendar, email, task management, approvals
- `BusinessSubagent.ts` — inherits BusinessManagerAgent lane rules; payroll, ecommerce, real estate, acquisitions

#### Execution Flow

1. **User request arrives** at `POST /api/orchestrate` with message and optional explicit target lane
2. **ZAR gives the order**: SubagentOrchestrator loads ZAR Core rules (Cognitive Core, Lexicon Authority, Principle Engine, Governance), applies Lexicon resolution to the message, and assembles the dispatch context
3. **Subagents spawn in parallel**: Factory creates instances of available subagents; each runs concurrently with access to the same context
4. **Each subagent determines its lane**: Using keyword detection, LLM classification (if enabled), and message context, each subagent decides:
   - Does this request activate my lane? (e.g., "is there a trading element?" → FinanceSubagent yes/no)
   - What capability level does my lane need? (analysis, action, approval, retrieval, synthesis, etc.)
   - What approval policies apply to my lane's actions?
5. **Subagents execute their responsibilities**: Only activated subagents run; each generates its own reasoning trace, applies its lane-specific policies, and returns a typed result
6. **Results aggregate**: ResultAggregator collects all subagent results, de-duplicates, prioritizes by confidence, and merges into a unified response respecting voice/presentation policy
7. **User gets the answer**: Single synthesized response with integrated reasoning and action recommendations from all active lanes

#### Lane Definitions and Subagent Capabilities

**FinanceSubagent** (Trading Intelligence phase):
- Activates on: trading, crypto, forex, options, ETFs, backtesting, paper trades, trade theses, position management, wealth planning, portfolio analysis, risk controls
- Enforces: FinanceAgent SKILL.md rules (market context, statistical edge, risk validation, continuous improvement)
- Outputs: trade theses, strategy audits, risk analysis, journal reviews, backtesting guidance
- Never: executes live trades, transmits orders, manages live capital

**IntelligenceSubagent** (R&D/Research):
- Activates on: research, web lookups, URLs, current/latest/news intent, analysis, deep research, explanations, comparisons, market scans
- Capabilities: web search, document analysis, trend synthesis, competitor research, knowledge graph retrieval
- Outputs: research summaries with sources, analysis reports, trend identification, curated collections

**OperationsSubagent** (Task & Calendar Management):
- Activates on: calendar, email, scheduling, reminders, tasks, posts, voicemail, invoicing, cancellations, bookings
- Capabilities: calendar integration, email drafting, task creation, approval routing
- Constraints: respects approval policies (Never, Ask, Auto per action type)
- Outputs: scheduled actions, draft communications, approval requests

**BusinessSubagent** (Business Operations):
- Activates on: payroll, contractors, ecommerce/dropshipping, real estate, business credit, acquisitions, business operations
- Capabilities: business intelligence, contractor/employee management, deal flow analysis
- Outputs: business recommendations, operational guidance

#### Approval and Authorization

- All subagent side effects (send email, schedule calendar, execute action) respect the approval policy from `hub/config/admin-settings.json`
- Each subagent consults `approvalPolicy.ts` before acting; policy routing works at the action level, not the lane level
- Non-autonomous actions are queued for admin approval; `Never` actions are refused with a logged reason
- Subagent execution traces are recorded per-lane; ResultAggregator preserves approval context in the final trace

#### Coordination and Memory

- Subagents coordinate indirectly through scoped memory, shared knowledge graph, and unified execution logs, not direct agent-to-agent chat
- All subagents have read access to shared Knowledge Graph, Lexicon Authority, Foundation memory, Project memory, and Personalization corpus
- Write operations to memory are validated and conflict-aware; canonical updates preserve provenance
- Scoped memory isolation ensures one subagent's working context does not leak into another's

#### Current Implemented Subagents

- `OperationsSubagent` — active, tested
- `IntelligenceSubagent` — active, tested
- `BusinessManagerSubagent` — active, tested
- `FinanceSubagent` — active, tested (Trading Intelligence phase)

#### Planned Subagent Expansions

- `IDEOperatorSubagent` — IDE orchestration, code execution, dev tools
- `AudioEngineerSubagent` — voice, audio processing, transcription
- Future specialized subagents for emerging capability areas

#### Explicit Lane Targeting (UI)

Agent-mode UI still supports explicit targeting:
- `Auto` — SubagentOrchestrator decides which subagents activate
- `Operations` — only OperationsSubagent
- `R&D` — only IntelligenceSubagent
- `Business` — only BusinessManagerSubagent
- `Finance` — only FinanceSubagent (when enabled)

#### Orchestrator Configuration

- `hub/config/parameters.yaml` can control subagent pool size, execution timeout per subagent, synthesis strategy
- `ZED_ORCHESTRATOR_PARALLEL_MODE=false` (if set) falls back to sequential subagent execution for debugging
- `ZED_ORCHESTRATOR_DISABLE_SUBAGENT_<name>=true` can disable specific subagents at runtime
- Runtime logs record subagent spawn, execution time per lane, and aggregation details for observability

### Knowledge Ingestion and Context

- Structured ingestion lives under `server/services/knowledge-ingestion/` and is registered through `server/routes-modules/knowledge-ingestion.ts`.
- Imported content is normalized into candidate knowledge first. It is not treated as canonical until validated or promoted.
- The ingestion pipeline performs source analysis, semantic decomposition, object detection, relationship mapping, timeline detection, decision extraction, conflict detection, duplicate-aware graph integration, and reasoning-index generation.
- Graph objects retain current truth, historical truth, evidence, confidence, contradictions, open questions, related objects, temporal status, and candidate/canonical state.
- Knowledge graph JSON under `hub/shared-memory/knowledge-graph/` is a local fallback/export area until a later durable database migration owns production graph state. It must not be treated as canonical personal user memory.
- Conflict resolution never overwrites silently. Resolved conflicts preserve the conflict record and update affected objects with a reviewed truth state.
- The Context Inquiry Engine sits between retrieval and response generation. It scores completeness, confidence, recency, relationship density, conflict count, context depth, and unknown fields.
- The Context Inquiry Engine returns `answer` only when uncertainty is immaterial. It returns `inquire_first` with minimal high-value questions when missing context would change classification, storage, reasoning, retrieval, or conflict resolution.
- This subsystem is intentionally service-owned and UI-agnostic so it can become a future ZCOS service.

### Lexicon Authority

The Lexicon Authority is a core subsystem of the Knowledge Authority, a sibling to the Knowledge Graph, Knowledge Ingestion, and Knowledge Curation Engine rather than a dependency of any one of them. Its job is to understand language before reasoning begins: words, phrases, abbreviations, acronyms, slang, symbols, technical terminology, cultural and community language, and user-specific vocabulary. It is not a spell checker, a thesaurus, or a flat dictionary — the same word can carry several unrelated or community-specific meanings, and the Lexicon's job is to identify which one applies given domain, community, and conversation context, not to flatten them into one definition.

Runtime implementation:

- Service: `server/services/lexicon-authority/LexiconAuthorityService.ts`
- Types (entry/relationship/authority/domain shapes): `server/services/lexicon-authority/types.ts`
- Storage: `server/services/lexicon-authority/store.ts`
- Domain manifest loader: `server/services/lexicon-authority/domains.ts`
- Seed lexicon: `server/services/lexicon-authority/seed.ts`
- Route wiring: `server/routes-modules/lexicon.ts`
- Cognitive Core wiring: `server/services/ChatExecutionService.ts` (`LexiconAuthorityService.resolveText` runs before Context Inquiry; see § Cognitive Core)
- Admin UI: `client/src/components/admin/sections/knowledge/LexiconView.tsx` (Knowledge tab -> Lexicon)

Storage and scope:

- Lexicon entries and relationships persist at `hub/shared-memory/lexicon/lexicon.json` — local fallback/export storage with the same non-canonical status as `hub/shared-memory/knowledge-graph/`, seeded once from `seed.ts` on first read and never treated as canonical personal user memory.
- The domain manifest is extensible without a code change at `hub/config/lexicon-domains.yaml`; `domains.ts` falls back to a bundled default list if the file is missing or fails to parse.
- The lexicon is a single shared store, not duplicated per workspace. Every subsystem (Memory, Identity, Projects, Workspaces, Finance, Trading, Marketing, ZWAP, Z-Citi, and future applications) queries the same authority instead of maintaining its own terminology.
- Relationships between entries reuse the Knowledge Graph's subject/predicate/object shape and predicate vocabulary (`is_a`, `part_of`, `related_to`, `derived_from`, `variant_of`, `abbreviation_of`, `synonym_of`, `antonym_of`, `community_variant_of`, `historical_form_of`, `successor_of`, `predecessor_of`) so the two subsystems agree on what a relationship is, without merging into one graph engine or one store.

Entry model:

- Each `LexiconEntry` represents one meaning of a term, not one term — a word with several meanings (bridge, swap, clock, mother, read, serve, shade, house, icon, ate) is several entries sharing a term string, linked to each other by relationships rather than flattened into a single definition.
- Fields include term, canonical form, variants, definition, alternate definitions, domains, communities, related/parent/child concepts, synonyms, antonyms, abbreviations, acronyms, example usage, confidence, authority, evidence, source, first-observed/last-confirmed timestamps, version, status (`candidate` | `verified` | `deprecated` | `rejected`), deprecation record, sensitivity flags, and notes.
- Authority sources are explicit and never assumed globally correct: Standard Dictionary, Scientific, Legal, Medical, Financial, Programming, Ballroom Community, Black Vernacular, LGBTQ+ Terminology, Internet Culture, ZAR/ZWAP/ZCOS/Z-Citi Internal, User Defined, Verified User, External Reference.
- Community language is preserved as its own entry rather than overwritten into standard English — e.g. Mother, Muva, and Motha are three linked entries (`community_variant_of` / `related_to`), not one entry with the others discarded as synonyms.

Discovery and learning:

- `registerCandidate` never permanently learns from one occurrence: a new candidate starts at low confidence, accumulates evidence on repeated occurrences, and only becomes `verified` through an explicit `confirmMeaning` (or is dropped via `rejectMeaning`). A user's own novel vocabulary registers scoped to that user (`ownerScope: "user"`) and is never silently promoted into the shared/global lexicon.
- Confirming a `user_defined` candidate upgrades its authority to `verified_user`, distinguishing "a user said this" from "this was reviewed and confirmed."
- `ChatExecutionService` calls `resolveText` on every message (read-only, deterministic, no model call) and separately registers unresolved quote/definition-style signals ("what does X mean", "define X", quoted terms) as low-confidence candidates — the resolution step itself never writes.

API surface (typed service methods, mirrored 1:1 as `/api/lexicon/*` routes): `resolveTerm`, `resolvePhrase`, `resolveMeaning`, `suggestMeaning`, `searchLexicon`, `searchDomain`, `searchCommunity`, `searchUserVocabulary`, `registerCandidate`, `confirmMeaning`, `rejectMeaning`, `mergeEntries`, `deprecateEntry`, `listDomains`, `listAuthorities`, `findRelatedTerms`. The UI and other subsystems only ever go through this surface — nothing reaches into the store directly.

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
- Admin/user settings (managed users, credentials, voice, approvals, integrations) use a two-tier store: the local `hub/config/admin-settings.json` is a fast runtime cache, and the durable source of truth is the Postgres `app_settings` table. Every mutation via `updateAdminSettings` writes both; at boot (after the DB is confirmed healthy) `hydrateAdminSettingsFromDb` restores the file from the table. This is what keeps users and credential changes from being erased when an ephemeral host (e.g. Render) wipes the container filesystem on redeploy. The JSON cache is not part of source control.
- The app currently supports one admin account plus admin-managed local users
- The canonical seeded admin user ID is `user_admin`.
- `GET /api/health` (alias `GET /healthz`) is an unauthenticated liveness ping that never touches the database or model provider; point an uptime monitor at it to keep the instance warm and avoid idle-spindown cold starts. Boot binds the HTTP server before the database/migration/memory warmup, so login (which needs only file-backed session + admin settings) responds immediately on a cold start while the DB warms up in the background.

## Data and Service Dependencies

### Local/Primary Dependencies

- Lightning AI is the sole model provider, accessed directly over HTTP through `server/core/providers/lightning-provider.ts`. There are no OpenAI, Claude, Ollama, or intermediary-gateway adapters. The endpoint is configured with `LIGHTNING_BASE_URL` (model via `LIGHTNING_MODEL` / `MODEL_NAME`, optional per-lane overrides via `MODEL_<lane>`).
- Durable database-backed application state where supported by the current schema.
- Filesystem-backed fallback, export, read-only legacy, and temporary processing storage only.
- Scoped memory content used by agents; shared system memory must be explicitly shared, and user memory must be explicitly user-owned.

## Memory Model

ZAR has four separate memory classes. These classes must not be collapsed into one shared folder or treated as interchangeable runtime truth.

1. ZAR Core

- Shared operating intelligence required by every ZAR user.
- Includes ZAR identity, reasoning governance, operating principles, orchestration rules, tool definitions, approval policy, retrieval policy, memory-handling policy, verification policy, response formation rules, and shared object/workspace contracts.
- Must not include personal conversations, uploaded user documents, user preferences, user projects, private business records, personal relationships, or historical ChatGPT exports.

2. Shared system knowledge

- Reusable knowledge deliberately installed for all users.
- Includes universal capability documentation, shared tool guidance, general reusable frameworks, and system-level educational material.
- Must be explicitly marked shared and must not contain personal user history.

3. User identity and personalization

- Owned by exactly one authenticated user.
- Includes preferred name, communication preferences, values, goals, working style, challenge preference, memory permissions, confirmed personalization, and proposed personalization awaiting confirmation.

4. User knowledge and history

- Owned by exactly one authenticated user.
- Includes uploaded files, imported conversations, project records, decisions, relationships, historical events, source documents, extracted objects, summaries, evidence, conflicts, and timelines.

Ownership requirements:

- User-owned memory reads and writes must require an authenticated `userId`.
- Missing ownership must fail clearly; memory code must not fall back to `user`, `user_001`, `default-user`, `anonymous`, `admin-user`, or any invented owner.
- User A must not retrieve User B's user-owned memory.
- Shared system knowledge must be distinguishable from user memory and must not be reassigned to a user by retrieval.
- ZAR Core must be distinguishable from shared system knowledge and from user memory.
- Production user memory must be stored through the repository's durable database architecture when the relevant schema exists. Filesystem storage may remain only as an existing local fallback, read-only legacy source, export, or temporary processing location.

Legacy archive classification:

- `zed-memory/` and `zed-memory/storage/` are the admin user's legacy personal historical corpus.
- Canonical owner: `user_admin`.
- Authority: historical evidence, not automatic current truth.
- Shared across users: never.
- Part of ZAR Core: no.
- Part of shared system knowledge: no.
- Writable by runtime: no.
- Active runtime source: no.
- Eligible for deletion now: no.
- Eligible for migration now: no.
- Later migration destination: admin-owned durable user memory, not shared memory.
- The archive must not be loaded for non-admin users and must not be exposed through ordinary user-memory APIs.
- Existing tracked legacy files remain preserved until a later verified migration and reconciliation pass.
- New raw personal exports or runtime memory files must not be added to Git.
- The archive role is documented in `zed-memory/LEGACY_BACKUP_MANIFEST.md`.

Current hub path policy:

- `hub/user-memory/<userId>/...` is scoped to a single authenticated user and may only be accessed for that owner.
- `hub/user-personalization/<userId>/...` is scoped to a single authenticated user and may only be accessed for that owner.
- `hub/shared-memory/...` may contain shared system material, local fallback graph/export files, and curation reports, but it is not the destination for personal history and must not receive normalized admin conversations as shared canonical memory.
- Knowledge curation review output may still be written under:
  - `hub/shared-memory/curation/latest-review.json`
  - `hub/shared-memory/curation/review-history.jsonl`

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

Every concept should have one canonical object. Non-canonical material should be represented as an alias, historical version, rejected proposal, archived draft, or supporting evidence. The canonical object represents ZAR's current understanding.

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

- `GET /api/health` (alias `GET /healthz`)
- `GET /api/me`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id`
- `DELETE /api/conversations/:id`
- `DELETE /api/conversations`
- `GET /api/conversations/:id/messages`
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
- `GET /api/lexicon/resolve`
- `GET /api/lexicon/resolve-phrase`
- `POST /api/lexicon/resolve-meaning`
- `POST /api/lexicon/resolve-text`
- `GET /api/lexicon/suggest`
- `GET /api/lexicon/search`
- `GET /api/lexicon/domains`
- `GET /api/lexicon/domains/:domainId/search`
- `GET /api/lexicon/communities/:communityId/search`
- `GET /api/lexicon/user-vocabulary`
- `GET /api/lexicon/authorities`
- `GET /api/lexicon/related`
- `POST /api/lexicon/candidates`
- `GET /api/lexicon/candidates`
- `GET /api/lexicon/overview`
- `POST /api/lexicon/entries/:id/confirm`
- `POST /api/lexicon/entries/:id/reject`
- `POST /api/lexicon/entries/:id/deprecate`
- `POST /api/lexicon/entries/merge`
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

Model inference is served remotely by Lightning AI; there is no local model-host boot. Set `LIGHTNING_BASE_URL` (and optionally `LIGHTNING_MODEL`) in the environment before starting the backend.

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
- `server/routes-modules/lexicon.ts`
- `server/services/KnowledgeCurationEngine.ts`
- `server/services/knowledge-ingestion/`
- `server/services/lexicon-authority/`
- `hub/config/lexicon-domains.yaml`
- `server/services/ZarResponseGovernance.ts`
- `server/services/ZarResponsePolicy.ts`
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

At server boot, ZAR initializes runtime directories, fallback storage, core memory, and the Knowledge Curation scheduler. The scheduler writes curation reports under `hub/shared-memory/curation/` and logs review status to the runtime log. This does not make `hub/shared-memory/` the destination for personal history or the owner of the admin legacy archive.

The backend is deployed to Render. Canonical deploy configuration is checked in at
`render.yaml` so runtime dependencies do not drift from code. The Webull OpenAPI
bridge follows Webull's official Python SDK path and therefore requires Python
3.8-3.13 plus `webull-openapi-python-sdk`; the Render blueprint pins
`PYTHON_VERSION=3.13.5`, installs `server/requirements.txt`, and sets
`WEBULL_PYTHON_BIN=python3` for the Node backend.

Secrets still live in Render environment variables, not Git:
`DATABASE_URL`, `SESSION_SECRET`, `LIGHTNING_API_KEY`, `LIGHTNING_BASE_URL`,
`WEBULL_APP_KEY`, and `WEBULL_APP_SECRET`.

## Documentation Policy

### Active Docs

- `SPEC.md`
- `docs/policies/MEMORY_IMPORT_POLICY.md`
- `docs/policies/KNOWLEDGE_CURATION_ENGINE.md`
- `docs/policies/LEXICON_AUTHORITY.md`

### Legacy Docs

Agent-specific skill markdown lives under `server/agents/**`. Those files are per-agent behavior notes; if one conflicts with this spec or the code, the code and `SPEC.md` win. The earlier `zed-docs/` tree and `docs/legacy/` files (Agentic_Guide*, SKILL.md) were removed in Phase 3 cleanup; they referenced Ollama, Netlify Functions, and the retired `/api/chat` route and were long superseded.

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

- The repo previously contained tracked local model artifacts under `models/`.
- Those model artifacts were removed from current reachable history and should not be added again.
- The target repository policy remains `main` and `backup`; the August 4, 2026 audit found additional remote branches still present.
- New raw memory exports must not be committed to Git and must not be merged into `hub/shared-memory/` as personal history.
- The existing `zed-memory/` archive has not been migrated, deleted, summarized, embedded, or made active at runtime.

## Current Audit Exceptions - August 4, 2026

These are verified differences between current `main` and the canonical requirements above. They are documented here so repository state is not mistaken for compliant architecture.

- Remote branch state does not yet match the target two-branch policy.
- `server/routes-modules/conversations-crud.ts` still falls back to `user_001` in the delete-all-conversations path when an authenticated owner ID is missing. That violates the Memory Model requirement that missing ownership fail clearly and never invent or reuse a fallback owner.
- Tracked admin foundation/user-memory material and tracked runtime-style log/output artifacts remain in the repository even though canonical policy prohibits new user data, personal exports, uploaded documents, and runtime memory from Git. Existing material requires a separate ownership, migration, retention, and removal review; this SPEC update does not authorize deletion.
- The Current API Surface is a maintained summary, not an exhaustive generated route inventory. The removed `POST /api/conversations/:id/messages` bypass has been deleted from the list; chat execution remains canonical through `POST /api/orchestrate`.
- The prior Frontend page list was stale and materially understated the routed application. It has been replaced with the current routed surface groups.
- Repository tests and client build were not certified by this documentation audit because dependency installation was blocked by the audit environment's npm cache/package extraction failures. No passing or failing code verdict is inferred from that environmental limitation.
