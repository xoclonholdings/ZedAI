# ZCOS Unified Intelligence Boundary Inside ZAR

ZCOS owns identity-bound context assembly, reasoning, planning, sourcing policy,
capability resolution, verification, and execution trace. ZAR owns the user
relationship, presentation, and assignment of work authorized by a ZCOS plan.

This directory is the extraction boundary for services that will eventually move into standalone Zebulon Commander / ZCOS.

## Active Ownership

- Flows: `server/zcos/flows/ZcosFlowEngine.ts`
- Flow persistence: `server/services/FlowStore.ts`
- Flow execution compatibility layer: `server/services/flow/FlowExecutor.ts`
- Capital capability boundary: `server/services/capital/*` and `server/routes-modules/capabilities.ts`

Budgeting, investing, market research, and trading implementations are owned by
`xoclonholdings/zillion-prosper`. ZAR retains only the authenticated launch,
owner-bound capability gateway, shared ZCOS services, and approval authority.
- Approvals: `server/services/approval/*`
- Tasks: `server/services/execution/TaskLifecycleManager.ts`
- Provider execution: `server/core/providers/*`
- Memory/context: `server/services/KnowledgeService.ts` and `hub/shared-memory/`
- Typed intelligence contracts: `shared/zcos-intelligence.ts`
- Unified reasoning/governance runtime: `server/zcos/runtime/*`
- Capability Registry and ZYLO resolution: `server/zcos/capabilities/*`
- Provider-neutral external adapters: `server/zcos/external/*`

## Boundary Rule

ZAR routes and UI may launch flows, display runs, approve/reject gates, show reports, and coordinate Capital work through the typed ZILLION capability. Every canonical chat turn submits a typed ZAR request to ZCOS and receives governed context plus a typed plan.

ZCOS services create runs, execute stages, validate sources, resolve capabilities, create approvals, track errors, verify results, and generate reports. External providers return candidate-only envelopes and cannot write Memory, Knowledge, Projects, or execution state. ZILLION stores trading knowledge, evaluates scanners, creates trade theses, manages paper trades, and calculates Capital performance.

PostgreSQL is authoritative for complete ZCOS execution traces. Prompt context,
vectors, model responses, and external-source payloads are projections or
candidates, never canonical storage.

## Capital Certification Rule

ZILLION supports education, analysis, simulation, paper trading, journaling, and strategy validation.

Live orders, real-money execution, and capital movement remain blocked pending separate certification.

## Current Extraction Path

1. Preserve legacy ZAR URLs as authenticated redirects.
2. Delegate Finance intent through `server/services/capital/CapitalGateway.ts`.
3. Expose only signed, owner-bound shared capabilities to ZILLION.
4. Keep Finance and Trading writers out of the ZAR runtime.
