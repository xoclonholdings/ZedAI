import { OperationsAgent, type AgentRequest, type AgentResponse } from "../agents/operations/OperationsAgent";
import { IntelligenceAgent, type ResearchRequest } from "../agents/intelligence/IntelligenceAgent";
import { BusinessManagerAgent } from "../agents/business-manager/BusinessManagerAgent";
import { FinanceAgent } from "../agents/finance/FinanceAgent";
import { KnowledgeService } from "../services/KnowledgeService";
import { ZedPrincipleEngine } from "../services/ZedPrincipleEngine";
import { ZedStrategicReasoningEngine } from "../services/ZedStrategicReasoningEngine";
import { getZedResponsePolicy, type ZedResponseMode } from "../services/ZedResponsePolicy";
import {
  buildZedGovernancePrompt,
  userRequestedSourceLinks,
} from "../services/ZedResponseGovernance";
import {
  buildZedVoicePrompt,
  presentZedResponse,
} from "../services/ZedVoiceFormationEngine";
import { checkTiers, filterOutputForTier3 } from "../middleware/TierEnforcement";

import { flushHubConfig, loadHubConfig } from "./manager-agent/config";
import { flushAccessPolicy } from "../services/AccessPolicyService";
import { isWebLookupIntent, selectAgentWithTrace } from "./manager-agent/agent-selection";
import { formatBrief } from "./manager-agent/format";
import { logRouting } from "./manager-agent/routing-log";
import type {
  OrchestratorRequest,
  OrchestratorResponse,
} from "./manager-agent/types";

function responseModeForAgent(agent: string): ZedResponseMode {
  if (agent === "IntelligenceAgent") return "research";
  if (agent === "BusinessManagerAgent" || agent === "FinanceAgent") return "strategy";
  return "chat";
}

/**
 * Front door for every agent-mode message. Walks tier enforcement,
 * builds the knowledge context, picks a lane, dispatches to the
 * right agent, and normalizes the response back into the shared
 * OrchestratorResponse shape that the chat execution service and
 * orchestrate-and-misc.ts both speak.
 *
 * The actual dispatching pieces live in ./manager-agent/:
 *   types.ts            - request/response shapes + AgentName
 *   config.ts           - YAML ruleset cache (load + flush)
 *   agent-selection.ts  - web-intent detection, LLM classifier,
 *                         keyword classifier, selectAgent()
 *   format.ts           - formatBrief for research replies
 *   routing-log.ts      - daily append-only routing log
 */
export class ManagerAgent {
  static async route(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const config = await loadHubConfig();
    const includeSources = userRequestedSourceLinks(request.message);

    const tierCheck = await checkTiers(
      request.message,
      request.userId,
      request.ip || "unknown",
    );
    if (tierCheck.blocked) {
      return {
        reply: await presentZedResponse(tierCheck.reply, {
          userMessage: request.message,
          includeSources,
          mode: "chat",
          grounded: true,
        }),
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
    const suppliedPrinciplePrompt =
      typeof request.context?.principlePrompt === "string"
        ? request.context.principlePrompt
        : "";
    const suppliedStrategicPrompt =
      typeof request.context?.strategicPrompt === "string"
        ? request.context.strategicPrompt
        : "";

    const routeDecision = await selectAgentWithTrace(request.message, config, request.targetAgent);
    const agent = routeDecision.selectedAgent;
    const responseMode = responseModeForAgent(agent);
    const strategicReasoning = ZedStrategicReasoningEngine.prepare({
      userMessage: request.message,
      lane: responseMode,
      knowledgePresent: Boolean(knowledgePrompt),
      currentContext: request.context,
    });
    const voiceMode: ZedResponseMode = strategicReasoning.active ? "strategy" : responseMode;
    const governancePrompt = buildZedGovernancePrompt({
      userMessage: request.message,
      lane: voiceMode,
      knowledgePresent: Boolean(knowledgePrompt),
    });
    const principlePrompt = ZedPrincipleEngine.buildPrompt({
      userMessage: request.message,
      lane: voiceMode,
      knowledgePresent: Boolean(knowledgePrompt),
      isAdmin: Boolean(request.context?.isAdmin),
    });
    const voicePrompt = await buildZedVoicePrompt({ mode: voiceMode });
    const agentContext = [
      governancePrompt,
      suppliedPrinciplePrompt,
      principlePrompt,
      suppliedStrategicPrompt,
      strategicReasoning.prompt,
      voicePrompt,
      knowledgePrompt,
      getZedResponsePolicy(voiceMode),
    ]
      .filter(Boolean)
      .join("\n\n");

    console.log(`[ManagerAgent] Routing to ${agent} for user ${request.userId}`);
    await logRouting(request, agent);

    let reply: string;
    let extra: Partial<OrchestratorResponse> = {};
    const baseMetadata = {
      intent: routeDecision.detectedIntent,
      actionType: "agent_response",
      selectedAgent: agent,
      classifierResult: routeDecision.classifierResult,
      classifierFailed: routeDecision.classifierFailed,
      fallbackUsed: routeDecision.fallbackUsed,
      fallbackReason: routeDecision.fallbackReason,
      executedServices: [] as string[],
      servicesInvoked: [] as string[],
      toolsInvoked: [] as string[],
      strategic: strategicReasoning.active,
    };

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
          memoryContext: agentContext,
        };
        const brief = await IntelligenceAgent.research(researchReq);
        reply = formatBrief(brief, { includeSources });
        extra = {
          metadata: {
            ...baseMetadata,
            actionType: "research",
            executedServices: ["IntelligenceAgent.research"],
            servicesInvoked: ["WebContentService.fetchWebTargetsFromText", "WebSearchService.webSearch", "ChromaService.querySimilarResearch"],
            brief,
            web: (brief as any).web,
          },
        };
        break;
      }

      case "BusinessManagerAgent": {
        const resp = await BusinessManagerAgent.process({
          userId: request.userId,
          task: request.message,
          conversationId: request.conversationId,
          memoryContext: agentContext,
        });
        return {
          reply: await presentZedResponse(filterOutputForTier3(resp.message), {
            userMessage: request.message,
            includeSources,
            mode: voiceMode,
            grounded: true,
          }),
          agent: resp.agent,
          requiresApproval: resp.requiresApproval,
          metadata: {
            ...baseMetadata,
            actionType: resp.requiresApproval ? "approval_required" : "business_analysis",
            executedServices: ["BusinessManagerAgent.process"],
            servicesInvoked: ["BusinessManagerAgent.process"],
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
          memoryContext: agentContext,
        });
        return {
          reply: await presentZedResponse(filterOutputForTier3(resp.message), {
            userMessage: request.message,
            includeSources,
            mode: voiceMode,
            grounded: true,
          }),
          agent: resp.agent,
          requiresApproval: resp.requiresApproval,
          metadata: {
            ...baseMetadata,
            actionType: (resp as any).tradingAction ? "trading_action" : "finance_analysis",
            executedServices: ["FinanceAgent.process"],
            servicesInvoked: [
              "FinanceAgent.process",
              ...(resp as any).tradingAction ? ["TradingStore.openPaperTrade"] : ["WebSearchService.webSearch", "TradingStore.getPerformance"],
            ],
            capabilities: resp.capabilities,
            tradingAction: (resp as any).tradingAction,
            recordId: (resp as any).recordId,
            missingFields: (resp as any).missingFields,
          },
        };
      }

      case "OperationsAgent":
      default: {
        const opReq: AgentRequest = {
          userId: request.userId,
          message: request.message,
          conversationId: request.conversationId,
          context: request.context,
          memoryContext: agentContext,
        };
        const opResp: AgentResponse = await OperationsAgent.process(opReq);
        reply = opResp.reply;
        extra = {
          requiresApproval: opResp.requiresApproval,
          pendingApproval: opResp.pendingApproval,
          metadata: {
            ...baseMetadata,
            actionType: opResp.requiresApproval ? "approval_required" : "operations_response",
            executedServices: ["OperationsAgent.process"],
            servicesInvoked: ["OperationsAgent.process", ...(opResp.requiresApproval ? ["AgentApprovalAdapter.register"] : [])],
            actions: opResp.actions,
            operationTask: (opResp as any).task,
            pendingApproval: opResp.pendingApproval,
          },
        };
        break;
      }
    }

    reply = await presentZedResponse(filterOutputForTier3(reply), {
      userMessage: request.message,
      includeSources,
      mode: voiceMode,
      grounded: true,
    });

    return {
      reply,
      agent,
      ...extra,
      metadata: {
        ...baseMetadata,
        ...(extra.metadata || {}),
      },
    };
  }

  /** Drop the cached YAML ruleset so the next request reloads from disk. */
  static flushConfig(): void {
    flushHubConfig();
    flushAccessPolicy();
  }
}
