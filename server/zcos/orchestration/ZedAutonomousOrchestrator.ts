import { ManagerAgent } from "../../orchestrator/ManagerAgent";
import type {
  OrchestratorRequest,
  OrchestratorResponse,
} from "../../orchestrator/manager-agent/types";

import { recommendFlowForMessage } from "./FlowRecommender";

function appendFlowSuggestion(reply: string, _recommendationName: string, reason: string): string {
  const cleanReply = reply.trim();
  const suggestion = `Next move: I can turn this into an executable ZED action. ${reason}`;

  if (!cleanReply) return suggestion;
  if (cleanReply.toLowerCase().includes("executable zed action")) return cleanReply;

  return `${cleanReply}\n\n${suggestion}`;
}

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

    const shouldSuggestFlow =
      !!flowRecommendation &&
      !response.blocked &&
      !response.requiresApproval &&
      typeof response.reply === "string";

    return {
      ...response,
      reply: shouldSuggestFlow
        ? appendFlowSuggestion(response.reply, flowRecommendation.name, flowRecommendation.reason)
        : response.reply,
      metadata,
    };
  }
}
