import { OperationsAgent, type AgentRequest, type AgentResponse } from "../agents/operations/OperationsAgent";
import { IntelligenceAgent, type ResearchRequest } from "../agents/intelligence/IntelligenceAgent";
import { BusinessManagerAgent } from "../agents/business-manager/BusinessManagerAgent";
import { FinanceAgent } from "../agents/finance/FinanceAgent";
import { KnowledgeService } from "../services/KnowledgeService";
import { checkTiers, filterOutputForTier3 } from "../middleware/TierEnforcement";

import { flushHubConfig, loadHubConfig } from "./manager-agent/config";
import { isWebLookupIntent, selectAgent } from "./manager-agent/agent-selection";
import { formatBrief } from "./manager-agent/format";
import { logRouting } from "./manager-agent/routing-log";
import type {
  OrchestratorRequest,
  OrchestratorResponse,
} from "./manager-agent/types";

/**
 * Front door for every agent-mode message. Walks tier enforcement,
 * builds the knowledge context, picks a lane, dispatches to the
 * right agent, and normalizes the response back into the shared
 * OrchestratorResponse shape that conversations-send.ts and
 * orchestrate-and-misc.ts both speak.
 *
 * The actual dispatching pieces live in ./manager-agent/:
 *   types.ts            — request/response shapes + AgentName
 *   config.ts           — YAML ruleset cache (load + flush)
 *   agent-selection.ts  — web-intent detection, LLM classifier,
 *                         keyword classifier, selectAgent()
 *   format.ts           — formatBrief for research replies
 *   routing-log.ts      — daily append-only routing log
 */
export class ManagerAgent {
  static async route(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const config = await loadHubConfig();

    const tierCheck = await checkTiers(
      request.message,
      request.userId,
      request.ip || "unknown",
    );
    if (tierCheck.blocked) {
      return {
        reply: tierCheck.reply,
        agent: "ManagerAgent",
        blocked: true,
        tier: tierCheck.tier,
      };
    }

    // Knowledge context can be supplied by the caller (routes-modules
    // do this so they can also feed it into the chat-mode prompt) or
    // built fresh here from KnowledgeService.
    const knowledgePrompt =
      typeof request.context?.knowledgePrompt === "string"
        ? request.context.knowledgePrompt
        : (
            await KnowledgeService.buildContext({
              userId: request.userId,
              query: request.message,
              conversationId: request.conversationId,
              lane: "manager",
            })
          ).prompt;

    const agent = await selectAgent(request.message, config, request.targetAgent);
    console.log(`[ManagerAgent] Routing to ${agent} for user ${request.userId}`);
    await logRouting(request, agent);

    let reply: string;
    let extra: Partial<OrchestratorResponse> = {};

    switch (agent) {
      case "IntelligenceAgent": {
        const researchReq: ResearchRequest = {
          userId: request.userId,
          query: request.message,
          depth:
            isWebLookupIntent(request.message) || request.message.length > 100
              ? "deep"
              : "shallow",
          conversationId: request.conversationId,
          memoryContext: knowledgePrompt,
        };
        const brief = await IntelligenceAgent.research(researchReq);
        reply = formatBrief(brief);
        extra = { metadata: { brief } };
        break;
      }

      case "BusinessManagerAgent": {
        const resp = await BusinessManagerAgent.process({
          userId: request.userId,
          task: request.message,
          conversationId: request.conversationId,
          memoryContext: knowledgePrompt,
        });
        return {
          reply: filterOutputForTier3(resp.message),
          agent: resp.agent,
          requiresApproval: resp.requiresApproval,
          metadata: {
            planned: resp.planned,
            capabilities: resp.capabilities,
            integration: "Business Operations",
          },
        };
      }

      case "FinanceAgent": {
        const resp = await FinanceAgent.process({
          userId: request.userId,
          task: request.message,
          conversationId: request.conversationId,
          memoryContext: knowledgePrompt,
        });
        return {
          reply: filterOutputForTier3(resp.message),
          agent: resp.agent,
          requiresApproval: resp.requiresApproval,
          metadata: { capabilities: resp.capabilities },
        };
      }

      case "OperationsAgent":
      default: {
        const opReq: AgentRequest = {
          userId: request.userId,
          message: request.message,
          conversationId: request.conversationId,
          context: request.context,
          memoryContext: knowledgePrompt,
        };
        const opResp: AgentResponse = await OperationsAgent.process(opReq);
        reply = opResp.reply;
        extra = {
          requiresApproval: opResp.requiresApproval,
          metadata: { actions: opResp.actions },
        };
        break;
      }
    }

    reply = filterOutputForTier3(reply);

    return {
      reply,
      agent,
      ...extra,
    };
  }

  /** Drop the cached YAML ruleset so the next request reloads from disk. */
  static flushConfig(): void {
    flushHubConfig();
  }
}
