# ZCOS Boundary Inside ZED

ZCOS owns execution logic. ZED owns presentation and HTTP routing.

This directory is the extraction boundary for services that will eventually move into standalone Zebulon Commander / ZCOS.

## Active Ownership

- Flows: `server/zcos/flows/ZcosFlowEngine.ts`
- Flow persistence: `server/services/FlowStore.ts`
- Flow execution compatibility layer: `server/services/flow/FlowExecutor.ts`
- Approvals: `server/services/approval/*`
- Tasks: `server/services/execution/TaskLifecycleManager.ts`
- Provider execution: `server/core/providers/*`
- Memory/context: `server/services/KnowledgeService.ts` and `hub/shared-memory/`

## Boundary Rule

ZED routes and UI may launch flows, display runs, approve/reject gates, and show reports.

ZCOS services create runs, execute stages, dispatch model/agent work, create approvals, write memory, track errors, and generate reports.

## Current Extraction Path

1. Keep existing ZED routes stable.
2. Move service imports behind `server/zcos/*` boundaries.
3. Keep hub-backed persistence file-based until ZCOS has its own storage layer.
4. Extract ZCOS services later without changing ZED UI contracts.
