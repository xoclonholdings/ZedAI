import { randomUUID } from "crypto";

import type {
  ZcosExecutionPlan,
  ZcosRequestEnvelope,
  ZcosResultEnvelope,
  ZcosSourceEnvelope,
} from "../../../shared/zcos-intelligence";
import { ZCOS_INTELLIGENCE_SCHEMA_VERSION } from "../../../shared/zcos-intelligence";
import type {
  OrchestratorRequest,
  OrchestratorResponse,
} from "../../orchestrator/manager-agent/types";
import type { ReasoningEffort } from "../../core/providers/provider-interface";
import { invokeCapital } from "../../services/capital/CapitalGateway";
import {
  ExternalIntelligenceAdapterRegistry,
  type ExternalIntelligenceAdapter,
} from "../external/ExternalIntelligenceAdapter";
import { LightningExternalIntelligenceAdapter } from "../external/LightningExternalIntelligenceAdapter";
import { WebSourceExternalIntelligenceAdapter } from "../external/WebSourceExternalIntelligenceAdapter";

import { recommendFlowForMessage } from "./FlowRecommender";

interface ZcosRouteContext {
  zcosRequest?: ZcosRequestEnvelope;
  zcosExecutionPlan?: ZcosExecutionPlan;
  zcosSources?: ZcosSourceEnvelope[];
  knowledgePrompt?: string;
  reasoningEffort?: ReasoningEffort;
  attachments?: any[];
}

function capabilityIsRunnable(plan: ZcosExecutionPlan | undefined, capabilityId: string): boolean {
  return Boolean(plan?.invocations.some((invocation) =>
    invocation.capabilityId === capabilityId &&
    (invocation.status === "planned" || invocation.status === "approved"),
  ));
}

function setCapabilityStatus(
  plan: ZcosExecutionPlan,
  capabilityId: string,
  status: "executing" | "completed" | "failed",
): void {
  const invocation = plan.invocations.find((candidate) => candidate.capabilityId === capabilityId);
  if (invocation) invocation.status = status;
  const assignment = plan.assignments.find((candidate) => candidate.capabilityId === capabilityId);
  if (assignment) {
    assignment.status = status === "executing" ? "running" : status;
  }
}

/**
 * ZAR-facing execution adapter.
 *
 * ZCOS has already produced the typed plan. This adapter performs only
 * registry-authorized work, returns typed source metadata, and never treats
 * a provider or specialist as ZCOS's reasoning authority.
 */
export class ZarAutonomousOrchestrator {
  private static readonly externalAdapters = (() => {
    const registry = new ExternalIntelligenceAdapterRegistry();
    registry.register(new LightningExternalIntelligenceAdapter());
    registry.register(new WebSourceExternalIntelligenceAdapter());
    return registry;
  })();

  static registerExternalIntelligenceAdapter(adapter: ExternalIntelligenceAdapter, priority = 100): void {
    this.externalAdapters.register(adapter, priority);
  }

  private static async retrieveExternalSources(
    zcosRequest: ZcosRequestEnvelope,
    plan: ZcosExecutionPlan,
    context: ZcosRouteContext,
  ) {
    if (!capabilityIsRunnable(plan, "zcos.external.model_synthesis")) {
      const modelGap = plan.capabilityGaps.find((gap) => gap.capabilityId === "zcos.external.model_synthesis");
      throw new Error(modelGap?.message || "Model synthesis capability was not resolved.");
    }
    const retrievalCapability = capabilityIsRunnable(plan, "zcos.external.web_fetch")
      ? "zcos.external.web_fetch"
      : "zcos.external.web_search";
    const adapter = this.externalAdapters.forOperation("source_retrieval")[0];
    if (!adapter) throw new Error("No certified source-retrieval adapter is registered.");

    setCapabilityStatus(plan, retrievalCapability, "executing");
    setCapabilityStatus(plan, "zcos.external.model_synthesis", "executing");
    try {
      const result = await adapter.execute({
        request: zcosRequest,
        operation: "source_retrieval",
        governedPrompt: context.knowledgePrompt || "",
        sources: context.zcosSources || [],
        reasoningEffort: context.reasoningEffort || "medium",
        attachments: context.attachments,
      });
      if (result.type === "error" || result.status === "failed") {
        setCapabilityStatus(plan, retrievalCapability, "failed");
        setCapabilityStatus(plan, "zcos.external.model_synthesis", "failed");
        return { adapter, result };
      }
      if (result.type !== "source_set") {
        throw new Error(`Unexpected source-retrieval result type: ${result.type}`);
      }
      setCapabilityStatus(plan, retrievalCapability, "completed");
      setCapabilityStatus(plan, "zcos.external.model_synthesis", "completed");
      return { adapter, result };
    } catch (error) {
      setCapabilityStatus(plan, retrievalCapability, "failed");
      setCapabilityStatus(plan, "zcos.external.model_synthesis", "failed");
      throw error;
    }
  }

  static async route(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const context = (request.context || {}) as ZcosRouteContext & Record<string, any>;
    const zcosRequest = context.zcosRequest;
    const plan = context.zcosExecutionPlan;
    if (!zcosRequest || !plan) throw new Error("ZCOS typed request and execution plan are required.");

    const flowRecommendationPromise = recommendFlowForMessage(request.message).catch(() => null);

    const retrievalRunnable = capabilityIsRunnable(plan, "zcos.external.web_search") ||
      capabilityIsRunnable(plan, "zcos.external.web_fetch");

    if (capabilityIsRunnable(plan, "zillion.capital.delegate")) {
      const retrieval = retrievalRunnable
        ? await this.retrieveExternalSources(zcosRequest, plan, context)
        : null;
      if (retrieval && (retrieval.result.type === "error" || retrieval.result.status === "failed")) {
        return {
          reply: retrieval.result.data.text,
          agent: "ZAR Research",
          requiresApproval: false,
          metadata: {
            intent: "capital_source_validation_failed",
            selectedAgent: "ZAR Brainstorm/Research",
            servicesInvoked: [`ExternalIntelligenceAdapter:${retrieval.adapter.id}`],
            capabilityIds: plan.invocations.map((invocation) => invocation.capabilityId),
            externalResult: retrieval.result,
            zcosSources: retrieval.result.data.sources || [],
            flowRecommendation: await flowRecommendationPromise,
          },
        };
      }
      const sources = retrieval?.result.data.sources || [];
      setCapabilityStatus(plan, "zillion.capital.delegate", "executing");
      let response: any;
      try {
        response = await invokeCapital<any>(request.userId, {
          conversationId: request.conversationId,
          task: request.message,
          executionPlanId: plan.planId,
          sourceIds: sources.map((source) => source.sourceId),
          sourceContext: sources.map((source) => ({
            sourceId: source.sourceId,
            title: source.title,
            content: source.content,
            provenance: source.provenance,
          })),
        });
        setCapabilityStatus(plan, "zillion.capital.delegate", "completed");
        setCapabilityStatus(plan, "zar.operate.tasks.prepare", "completed");
      } catch (error) {
        setCapabilityStatus(plan, "zillion.capital.delegate", "failed");
        throw error;
      }
      const reply = String(response.message || "");
      const externalResult: ZcosResultEnvelope<{ text: string }> = {
        schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
        resultId: randomUUID(),
        requestId: zcosRequest.requestId,
        type: "execution",
        status: reply.trim() ? "success" : "failed",
        data: { text: reply },
        sourceIds: sources.map((source) => source.sourceId),
        uncertainties: retrieval?.result.uncertainties || [],
        errors: [],
        provenance: {
          provider: "zillion_capital",
          retrievedAt: new Date().toISOString(),
          independenceKey: "galaxy:zillion-capital",
          transformation: "ZILLION result returned as a candidate to ZCOS verification.",
          lineage: [retrieval?.result.resultId, ...sources.map((source) => source.sourceId)].filter((id): id is string => Boolean(id)),
        },
        writeDisposition: "candidate_only",
      };
      return {
        reply,
        agent: "ZAR -> ZILLION Prosper",
        requiresApproval: Boolean(response.requiresApproval),
        metadata: {
          intent: "capital_delegation",
          selectedAgent: "ZILLION Prosper Capital",
          servicesInvoked: ["ZILLION Prosper Capital"],
          executionProvider: "zillion_capital",
          capabilityIds: plan.invocations.map((invocation) => invocation.capabilityId),
          web: retrieval?.result.data.metadata?.web,
          externalResult,
          intermediateResults: retrieval ? [retrieval.result] : [],
          flowRecommendation: await flowRecommendationPromise,
          zcosSources: sources,
        },
      };
    }

    if (retrievalRunnable) {
      const retrieval = await this.retrieveExternalSources(zcosRequest, plan, context);
      const externalResult = retrieval.result;
      const sources = externalResult.data.sources || [];
      return {
        reply: externalResult.data.text,
        agent: "ZAR Research",
        requiresApproval: false,
        metadata: {
          intent: externalResult.type === "error" || externalResult.status === "failed"
            ? "governed_research_failed"
            : "governed_research",
          selectedAgent: "ZAR Brainstorm/Research",
          servicesInvoked: [`ExternalIntelligenceAdapter:${retrieval.adapter.id}`],
          capabilityIds: plan.invocations.map((invocation) => invocation.capabilityId),
          web: externalResult.data.metadata?.web,
          sources: externalResult.data.metadata?.sourceLabels,
          externalResult,
          zcosSources: sources,
          flowRecommendation: await flowRecommendationPromise,
        },
      };
    }

    if (plan.externalRetrievalRequired) {
      const retrievalGap = plan.capabilityGaps.find((gap) =>
        gap.capabilityId === "zcos.external.web_search" || gap.capabilityId === "zcos.external.web_fetch",
      );
      throw new Error(retrievalGap?.message || "Required current-source retrieval was not resolved.");
    }
    if (!capabilityIsRunnable(plan, "zcos.external.model_synthesis")) {
      const modelGap = plan.capabilityGaps.find((gap) => gap.capabilityId === "zcos.external.model_synthesis");
      throw new Error(modelGap?.message || "Model synthesis capability was not resolved.");
    }
    const adapter = this.externalAdapters.forOperation("model_synthesis")[0];
    if (!adapter) throw new Error("No certified model-synthesis adapter is registered.");
    setCapabilityStatus(plan, "zcos.external.model_synthesis", "executing");
    let externalResult: Awaited<ReturnType<ExternalIntelligenceAdapter["execute"]>>;
    try {
      externalResult = await adapter.execute({
        request: zcosRequest,
        operation: "model_synthesis",
        governedPrompt: context.knowledgePrompt || "",
        sources: context.zcosSources || [],
        reasoningEffort: context.reasoningEffort || "medium",
        attachments: context.attachments,
      });
    } catch (error) {
      setCapabilityStatus(plan, "zcos.external.model_synthesis", "failed");
      throw error;
    }
    if (externalResult.type === "error" || externalResult.status === "failed") {
      setCapabilityStatus(plan, "zcos.external.model_synthesis", "failed");
      return {
        reply: externalResult.data.text,
        agent: "ZAR",
        requiresApproval: false,
        metadata: {
          intent: "zcos_governed_response_failed",
          selectedAgent: "ZAR",
          servicesInvoked: ["ZCOS Capability Runtime", `ExternalIntelligenceAdapter:${adapter.id}`],
          capabilityIds: plan.invocations.map((invocation) => invocation.capabilityId),
          externalResult,
          zcosSources: [],
          flowRecommendation: await flowRecommendationPromise,
        },
      };
    }
    if (externalResult.type !== "execution") {
      setCapabilityStatus(plan, "zcos.external.model_synthesis", "failed");
      throw new Error(`Unexpected external result type: ${externalResult.type}`);
    }
    setCapabilityStatus(plan, "zcos.external.model_synthesis", "completed");
    setCapabilityStatus(plan, "zar.operate.tasks.prepare", "completed");
    return {
      reply: externalResult.data.text,
      agent: "ZAR",
      requiresApproval: plan.approvalIds.length > 0,
      metadata: {
        intent: "zcos_governed_response",
        selectedAgent: "ZAR",
        servicesInvoked: ["ZCOS Capability Runtime", `ExternalIntelligenceAdapter:${adapter.id}`],
        capabilityIds: plan.invocations.map((invocation) => invocation.capabilityId),
        externalResult,
        zcosSources: [],
        flowRecommendation: await flowRecommendationPromise,
      },
    };
  }
}
