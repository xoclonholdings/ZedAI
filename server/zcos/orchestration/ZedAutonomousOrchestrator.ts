import { ManagerAgent } from "../../orchestrator/ManagerAgent";
import type {
  OrchestratorRequest,
  OrchestratorResponse,
} from "../../orchestrator/manager-agent/types";

import { recommendFlowForMessage } from "./FlowRecommender";

/**
 * ZCOS-owned autonomous orchestration boundary.
 *
 * ZED sends user intent here. ZCOS decides routing, memory/context use,
 * agent dispatch, optional flow acceleration, and approval metadata.
 * Legacy manual targetAgent values are intentionally ignored here so the
 * primary chat experience remains outcome-driven.
 */
export class ZedAutonomousOrchestrator {
  static async route(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const autonomousRequest: OrchestratorRequest = {
      ...request,
      targetAgent: undefined,
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
