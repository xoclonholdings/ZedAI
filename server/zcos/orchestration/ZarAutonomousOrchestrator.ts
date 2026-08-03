import { SubagentOrchestrator } from "../../orchestrator/subagents/SubagentOrchestrator";
import type {
  OrchestratorRequest,
  OrchestratorResponse,
} from "../../orchestrator/manager-agent/types";

import { recommendFlowForMessage } from "./FlowRecommender";

/**
 * ZCOS-owned autonomous orchestration boundary.
 *
 * ZAR sends user intent here. ZCOS decides routing, memory/context use,
 * subagent dispatch, optional flow acceleration, and approval metadata.
 * Subagents run in parallel; each autonomously determines which lane(s) to activate.
 */
export class ZarAutonomousOrchestrator {
  private static orchestrator = new SubagentOrchestrator({
    maxConcurrency: 4,
    executionTimeoutMs: 30000,
    enableParallel: true,
  });

  static async route(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const workspaceTarget =
      typeof request.context?.workspaceId === "string" && request.context.workspaceId.trim()
        ? request.targetAgent
        : undefined;

    const [subagentResult, flowRecommendation] = await Promise.all([
      this.orchestrator.dispatch({
        message: request.message,
        userId: request.userId,
        conversationId: request.conversationId || "",
        traceId: request.context?.traceId || "",
        explicitLane: workspaceTarget as any,
        parameters: request.context || {},
        approvalPolicy: request.context?.approvalPolicy,
      }),
      recommendFlowForMessage(request.message).catch(() => null),
    ]);

    // Transform subagent results back to OrchestratorResponse format for backward compatibility
    const activeLaneLabels = subagentResult.activeLanes.join(", ");
    const reply =
      subagentResult.consolidatedResponse ||
      `No response from lanes: ${activeLaneLabels || "none activated"}`;

    const metadata = {
      autonomousSubagents: true,
      activeLanes: subagentResult.activeLanes,
      subagentCount: subagentResult.subagentResults.length,
      activatedCount: subagentResult.subagentResults.filter((r) => r.activated).length,
      synthesisStrategy: subagentResult.synthesisStrategy,
      totalExecutionTime: subagentResult.totalExecutionTime,
      approvalsRequired: subagentResult.approvalsRequired,
      pendingApprovals: subagentResult.pendingApprovals,
      selectedAgent: activeLaneLabels || "none",
      intent: "subagent_dispatch",
      ...(flowRecommendation ? { flowRecommendation } : {}),
    };

    return {
      reply,
      agent: `SubagentOrchestrator(${activeLaneLabels || "none"})`,
      metadata,
      requiresApproval: subagentResult.approvalsRequired,
    };
  }
}
