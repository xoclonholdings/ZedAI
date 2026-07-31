import { ManagerAgent } from "../../orchestrator/ManagerAgent";
import type {
  OrchestratorRequest,
  OrchestratorResponse,
} from "../../orchestrator/manager-agent/types";

import { recommendFlowForMessage } from "./FlowRecommender";

/**
 * ZCOS-owned autonomous orchestration boundary.
 *
 * ZAR sends user intent here. ZCOS decides routing, memory/context use,
 * agent dispatch, optional flow acceleration, and approval metadata.
 * Legacy manual targetAgent values are ignored unless they come with a
 * workspace id. That keeps normal chat outcome-driven while preserving
 * workspace lane intent.
 */
export class ZarAutonomousOrchestrator {
  static async route(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const workspaceTarget =
      typeof request.context?.workspaceId === "string" && request.context.workspaceId.trim()
        ? request.targetAgent
        : undefined;
    const autonomousRequest: OrchestratorRequest = {
      ...request,
      targetAgent: workspaceTarget,
    };

    const [response, flowRecommendation] = await Promise.all([
      ManagerAgent.route(autonomousRequest),
      recommendFlowForMessage(request.message).catch(() => null),
    ]);

    const metadata = {
      ...(response.metadata || {}),
      autonomous: true,
      ...(flowRecommendation ? { flowRecommendation } : {}),
    };

    return {
      ...response,
      reply: response.reply,
      metadata,
    };
  }
}
