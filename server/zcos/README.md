# ZCOS Boundary Inside ZED

ZCOS owns execution logic. ZED owns presentation and HTTP routing.

This directory is the extraction boundary for services that will eventually move into standalone Zebulon Commander / ZCOS.

## Active Ownership

- Flows: `server/zcos/flows/ZcosFlowEngine.ts`
- Flow persistence: `server/services/FlowStore.ts`
- Flow execution compatibility layer: `server/services/flow/FlowExecutor.ts`
- Trading Intelligence Phase 1: `server/zcos/trading/*`
- Approvals: `server/services/approval/*`
- Tasks: `server/services/execution/TaskLifecycleManager.ts`
- Provider execution: `server/core/providers/*`
- Memory/context: `server/services/KnowledgeService.ts` and `hub/shared-memory/`

## Boundary Rule

ZED routes and UI may launch flows, display runs, approve/reject gates, show reports, and expose trading intelligence endpoints.

ZCOS services create runs, execute stages, dispatch model/agent work, create approvals, write memory, track errors, generate reports, store trading knowledge, evaluate scanner observations, create trade theses, manage paper trades, and calculate simulation performance.

## Trading Phase 1 Rule

Trading Intelligence is education, analysis, simulation, paper trading, journaling, and strategy validation only.

There are no broker connections, live orders, real-money execution, or capital movement in Phase 1.

## Current Extraction Path

1. Keep existing ZED routes stable.
2. Move service imports behind `server/zcos/*` boundaries.
3. Keep hub-backed persistence file-based until ZCOS has its own storage layer.
4. Extract ZCOS services later without changing ZED UI contracts.
