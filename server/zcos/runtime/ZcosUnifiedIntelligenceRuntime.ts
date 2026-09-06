import { randomUUID } from "crypto";

import {
  ZCOS_INTELLIGENCE_SCHEMA_VERSION,
  type ZcosCapabilityGap,
  type ZcosExecutionPlan,
  type ZcosExecutionTrace,
  type ZcosPermission,
  type ZcosReasoningDepth,
  type ZcosRequestEnvelope,
  type ZcosResultEnvelope,
  type ZcosSourceEnvelope,
  type ZcosTaskAssignment,
  type ZcosUncertaintyEnvelope,
  type ZcosVerificationEnvelope,
  type ZarResponseForm,
} from "../../../shared/zcos-intelligence";
import type { ReasoningEffort } from "../../core/providers/provider-interface";
import { getProviderRuntimeConfig } from "../../core/providers/provider-config";
import { webSearchAvailable } from "../../services/WebSearchService";
import { keywords } from "../../services/intelligence-core/analysis";
import { ContextIntelligenceEngine } from "../../services/intelligence-core/ContextIntelligenceEngine";
import { IntelligenceCore } from "../../services/intelligence-core";
import type { ComplexityBand, IntelligenceCorePlan } from "../../services/intelligence-core/types";
import { zcosCapabilityRegistry } from "../capabilities/ZcosCapabilityRegistry";
import { SourceConfluenceEngine } from "./SourceConfluenceEngine";
import { ZcosExecutionTraceStore } from "./ZcosExecutionTraceStore";
import { ZcosPolicyEngine } from "./ZcosPolicyEngine";

export interface ZcosRuntimePrepareInput {
  request: ZcosRequestEnvelope;
  sources: ZcosSourceEnvelope[];
  strategic: boolean;
  materialUncertainty: boolean;
  hasFiles: boolean;
  hasGraphContext: boolean;
  hasMemory: boolean;
  clarificationOnly?: boolean;
  configuredIntegrations?: Set<string>;
  approvedCapabilityIds?: Set<string>;
}

export interface ZcosPreparedRuntime {
  request: ZcosRequestEnvelope;
  sources: ZcosSourceEnvelope[];
  governedContext: string;
  reasoningPrompt: string;
  responsePrompt: string;
  reasoningEffort: ReasoningEffort;
  intelligencePlan: IntelligenceCorePlan;
  executionPlan: ZcosExecutionPlan;
  uncertainties: ZcosUncertaintyEnvelope[];
  trace: ZcosExecutionTrace;
  contextCompressionRatio: number;
}

const EXTERNAL_ACTION = /\b(send|email|publish|post|pay|invoice|deploy|delete|cancel|transfer|purchase|sign|book)\b/i;
const TASK_PREPARATION = /\b(build(?:ing)?|implement(?:ing|ation)?|fix(?:ing|es|ed)?|create|update|prepare|plan|draft|organize|set up|deploy(?:ing|ment)?|publish(?:ing)?|schedule|automate)\b/i;
const CAPITAL = /\b(budget|trading|trade|invest(?:ment|ing|or)?|portfolio|capital|stock|crypto|forex|futures)\b/i;
const ZYNC_WORK = /\b(code|coding|repository|repo|software|website|app|api|backend|frontend|database|typescript|javascript|react|build(?:ing)?|implement(?:ing|ation)?|fix(?:ing|es|ed)?|debug(?:ging)?|deploy(?:ing|ment)?|push(?:ing)?|commit(?:ting)?|design|publish(?:ing)?)\b/i;
const ZYLO_WORK = /\b(automate|automation|workflow|trigger|recurring|schedule|remind|reminder|routine|loop)\b/i;
const ZENA_WORK = /\b(security|secure|vulnerabilit|malware|firewall|integrity|credential|permission|authorization|audit log|diagnostic|monitoring)\b/i;
const ZENO_WORK = /\b(email|message|meeting|calendar|invite|recipient|thread|room|team communication|collaborat)\b/i;
const ZENITH_WORK = /\b(lesson|curriculum|learning studio|study plan|teach|course|scholar|library catalog)\b/i;
const ZWAP_WORK = /\b(discover|discovery|news feed|journal|glow|explore)\b/i;
const EXPLICIT_EXTERNAL = /\b(search the web|browse|look up|research online|visit|open (?:the )?(?:site|url|link)|https?:\/\/|www\.)\b/i;
const DIRECT_URL = /\b(?:https?:\/\/|www\.)/i;

function reasoningDepthForComplexity(complexity: ComplexityBand): ZcosReasoningDepth {
  if (complexity === "deep") return "exhaustive";
  if (complexity === "complex") return "deep";
  if (complexity === "moderate") return "standard";
  return "direct";
}

function effortForDepth(depth: ZcosReasoningDepth): ReasoningEffort {
  if (depth === "exhaustive") return "deep";
  if (depth === "deep") return "high";
  if (depth === "standard") return "medium";
  return "low";
}

function defaultConfiguredIntegrations(): Set<string> {
  const config = getProviderRuntimeConfig();
  const integrations = new Set<string>();
  if (config.lightning.baseUrl && config.lightning.apiKey) integrations.add("model_provider");
  if (webSearchAvailable()) integrations.add("web_search");
  if (
    process.env.ZILLION_PROSPER_API_URL?.trim() &&
    (process.env.ZILLION_CAPABILITY_SECRET?.trim().length || 0) >= 32
  ) integrations.add("zillion_capital");
  return integrations;
}

function permissionsFor(request: ZcosRequestEnvelope): Set<ZcosPermission> {
  const permissions = new Set<ZcosPermission>(["model:invoke", "workflow:resolve", "action:prepare"]);
  if (request.permissions.memory) permissions.add("memory:read");
  if (request.permissions.knowledge) permissions.add("knowledge:read");
  if (request.permissions.projects) permissions.add("projects:read");
  if (request.permissions.externalRetrieval) permissions.add("external:read");
  if (request.permissions.externalActions) permissions.add("action:execute");
  return permissions;
}

function needsExternalRetrieval(request: ZcosRequestEnvelope, sources: ZcosSourceEnvelope[]): {
  required: boolean;
  reason?: string;
} {
  if (request.intent.explicitFreshness) return { required: true, reason: "The request is time-sensitive." };
  if (request.intent.stakes === "high") return { required: true, reason: "The request is high-stakes and requires current-source validation." };
  if (EXPLICIT_EXTERNAL.test(request.payload.message)) return { required: true, reason: "The user explicitly requested external retrieval." };
  const queryKeywords = keywords(request.payload.message);
  const authoritativeInternal = sources.some(
    (source) => {
      if (source.authority !== "canonical" || source.currency !== "current" || source.confidence < 0.7) return false;
      const searchable = `${source.title} ${source.content}`.toLowerCase();
      return queryKeywords.length === 0 || queryKeywords.some((keyword) => searchable.includes(keyword));
    },
  );
  if (request.intent.kind === "research" && !authoritativeInternal) {
    return { required: true, reason: "Internal sources do not sufficiently cover the research objective." };
  }
  return { required: false };
}

function sourcePriority(source: ZcosSourceEnvelope): number {
  if (source.originClass === "user_supplied") return 1;
  if (source.authority === "canonical") return 0.95;
  if (source.originClass === "external_primary") return 0.85;
  if (source.originClass === "external_secondary") return 0.65;
  return 0.4;
}

function galaxyCapabilityFor(message: string): string | undefined {
  if (CAPITAL.test(message)) return "zillion.capital.delegate";
  if (ZENA_WORK.test(message)) return "zena.integrity.delegate";
  if (ZYLO_WORK.test(message)) return "zylo.automate.delegate";
  if (ZENO_WORK.test(message)) return "zeno.unite.delegate";
  if (ZENITH_WORK.test(message)) return "zenith.scholar.delegate";
  if (ZWAP_WORK.test(message)) return "zwap.discovery.delegate";
  if (ZYNC_WORK.test(message)) return "zync.build.delegate";
  return undefined;
}

function zarResponseForm(form: string, request: ZcosRequestEnvelope): ZarResponseForm {
  if (form === "research_result") return "research_result";
  if (form === "writing_artifact") return "writing_artifact";
  if (form === "visual_explanation") return "visual_explanation";
  if (form === "file") return "file";
  if (form === "approval_request") return "approval_request";
  if (form === "implementation_task" || form === "code") return "implementation_task";
  if (request.intent.kind === "research") return "research_result";
  if (request.intent.kind === "decision" || request.intent.kind === "analysis") return "concise_rationale";
  return "direct_answer";
}

function assignmentsFor(
  request: ZcosRequestEnvelope,
  capabilityId: string | undefined,
  invocations: ZcosExecutionPlan["invocations"],
  gaps: ZcosCapabilityGap[],
): ZcosTaskAssignment[] {
  if (!capabilityId) return [];
  const invocation = invocations.find((candidate) => candidate.capabilityId === capabilityId);
  const gap = gaps.find((candidate) => candidate.capabilityId === capabilityId);
  const status: ZcosTaskAssignment["status"] = gap || invocation?.status === "blocked"
    ? "blocked"
    : invocation?.approvalRequired
      ? "awaiting_approval"
      : invocation?.status === "completed"
        ? "completed"
        : "prepared";
  return [{
    assignmentId: invocation?.invocationId || randomUUID(),
    requestId: request.requestId,
    ownerGalaxy: invocation?.ownerGalaxy || zcosCapabilityRegistry.get(capabilityId)?.ownerGalaxy || "ZAR",
    capabilityId,
    objective: request.intent.objective,
    status,
    approvalRequired: Boolean(invocation?.approvalRequired),
    blocker: gap?.message,
  }];
}

export class ZcosUnifiedIntelligenceRuntime {
  static prepare(input: ZcosRuntimePrepareInput): ZcosPreparedRuntime {
    const { request } = input;
    const trace: ZcosExecutionTrace = {
      schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
      traceId: request.traceId,
      requestId: request.requestId,
      ownerUserId: request.owner.ownerUserId,
      originGalaxy: "ZAR",
      startedAt: request.submittedAt,
      stages: [],
      contextSourceIds: [],
      sourceProvenance: [],
      capabilityIds: [],
      approvalIds: [],
      resultIds: [],
      results: [],
      errors: [],
    };
    const stage = (engine: ZcosExecutionTrace["stages"][number]["engine"], status: ZcosExecutionTrace["stages"][number]["status"], detail?: string) => {
      trace.stages.push({ engine, status, at: new Date().toISOString(), detail });
    };

    stage("identity", "completed", `Authenticated owner ${request.owner.ownerUserId}.`);
    const eligibleSources = input.sources.filter((source) => {
      if (source.type === "memory" && !request.permissions.memory) return false;
      if (source.type === "knowledge" && !request.permissions.knowledge) return false;
      if (source.type === "project" && !request.permissions.projects) return false;
      return source.provenance.retrievedAt && source.content.trim();
    });
    trace.contextSourceIds = eligibleSources.map((source) => source.sourceId);
    trace.sourceProvenance = eligibleSources.map((source) => ({
      sourceId: source.sourceId,
      type: source.type,
      authority: source.authority,
      originGalaxy: source.originGalaxy,
      originClass: source.originClass,
      confidence: source.confidence,
      currency: source.currency,
      provenance: source.provenance,
    }));
    stage("memory", request.permissions.memory ? "completed" : "blocked", request.permissions.memory ? "Authorized Memory projection evaluated." : "Memory disabled for this channel.");
    stage("knowledge", request.permissions.knowledge ? "completed" : "blocked", request.permissions.knowledge ? "Authorized Knowledge projection evaluated." : "Knowledge disabled for this channel.");
    stage("learning", "completed", "Authorized learning context evaluated.");

    const intelligence = IntelligenceCore.analyze({
      message: request.payload.message,
      lane: "zcos",
      strategic: input.strategic,
      knowledgePresent: eligibleSources.length > 0,
      materialUncertainty: input.materialUncertainty,
      hasFiles: input.hasFiles,
      hasGraphContext: input.hasGraphContext,
      hasMemory: input.hasMemory,
    });
    const reasoningDepth = reasoningDepthForComplexity(intelligence.deepThinking.complexity);
    trace.reasoningDepth = reasoningDepth;
    stage("reasoning", "completed", `Reasoning depth: ${reasoningDepth}.`);

    const external = input.clarificationOnly
      ? { required: false, reason: undefined }
      : needsExternalRetrieval(request, eligibleSources);
    const requestedCapabilities = new Set<string>([
      "zcos.context.internal",
      "zcos.reasoning.plan",
    ]);
    let retrievalCapabilityId: string | undefined;
    if (external.required) {
      retrievalCapabilityId = DIRECT_URL.test(request.payload.message) ? "zcos.external.web_fetch" : "zcos.external.web_search";
      requestedCapabilities.add(retrievalCapabilityId);
    }
    const galaxyCapabilityId = input.clarificationOnly
      ? undefined
      : galaxyCapabilityFor(request.payload.message);
    const capitalDelegation = galaxyCapabilityId === "zillion.capital.delegate";
    if (!input.clarificationOnly) requestedCapabilities.add("zcos.external.model_synthesis");
    for (const capabilityId of request.payload.requestedCapabilityIds || []) requestedCapabilities.add(capabilityId);
    if (!input.clarificationOnly && TASK_PREPARATION.test(request.payload.message)) requestedCapabilities.add("zar.operate.tasks.prepare");
    if (!input.clarificationOnly && EXTERNAL_ACTION.test(request.payload.message)) requestedCapabilities.add("zar.external.action");
    if (galaxyCapabilityId) requestedCapabilities.add(galaxyCapabilityId);

    const resolution = zcosCapabilityRegistry.resolve([...requestedCapabilities], {
      permissions: permissionsFor(request),
      configuredIntegrations: input.configuredIntegrations || defaultConfiguredIntegrations(),
      approvedCapabilityIds: input.approvedCapabilityIds,
    });
    const capitalResolved = resolution.invocations.some((invocation) =>
      invocation.capabilityId === "zillion.capital.delegate" && invocation.status === "planned",
    );
    if (capitalResolved && !external.required) {
      const synthesisIds = new Set(
        resolution.invocations
          .filter((invocation) => invocation.capabilityId === "zcos.external.model_synthesis")
          .map((invocation) => invocation.invocationId),
      );
      resolution.invocations = resolution.invocations.filter((invocation) => invocation.capabilityId !== "zcos.external.model_synthesis");
      resolution.gaps = resolution.gaps.filter((gap) => gap.capabilityId !== "zcos.external.model_synthesis");
      resolution.sequentialOrder = resolution.sequentialOrder.filter((id) => !synthesisIds.has(id));
      resolution.parallelGroups = resolution.parallelGroups
        .map((group) => group.filter((id) => !synthesisIds.has(id)))
        .filter((group) => group.length > 1);
    }
    if (retrievalCapabilityId) {
      const synthesis = resolution.invocations.find((invocation) => invocation.capabilityId === "zcos.external.model_synthesis");
      if (synthesis && !synthesis.dependencyIds.includes(retrievalCapabilityId)) {
        synthesis.dependencyIds.push(retrievalCapabilityId);
      }
    }
    for (const invocation of resolution.invocations) {
      if (
        invocation.status === "planned" &&
        (invocation.capabilityId === "zcos.context.internal" || invocation.capabilityId === "zcos.reasoning.plan")
      ) {
        invocation.status = "completed";
      }
    }
    const executionPlan: ZcosExecutionPlan = {
      planId: randomUUID(),
      requestId: request.requestId,
      reasoningDepth,
      externalRetrievalRequired: external.required,
      externalRetrievalReason: external.reason,
      invocations: resolution.invocations,
      parallelGroups: resolution.parallelGroups,
      sequentialOrder: resolution.sequentialOrder,
      capabilityGaps: resolution.gaps,
      approvalIds: resolution.invocations.filter((invocation) => invocation.approvalRequired).map((invocation) => invocation.invocationId),
      responseForm: zarResponseForm(intelligence.responseOrchestration.form, request),
      assignments: assignmentsFor(request, galaxyCapabilityId, resolution.invocations, resolution.gaps),
    };
    trace.capabilityIds = executionPlan.invocations.map((invocation) => invocation.capabilityId);
    trace.approvalIds = [...executionPlan.approvalIds];
    trace.executionPlan = executionPlan;
    stage("orchestration", resolution.gaps.length ? "partial" : "completed", `${resolution.invocations.length} capabilities resolved; ${resolution.gaps.length} gaps preserved.`);

    const ranked = ContextIntelligenceEngine.rank(
      request.payload.message,
      eligibleSources.map((source) => ({
        label: source.sourceId,
        text: source.content,
        pinned: source.originClass === "user_supplied" || source.authority === "canonical",
        basePriority: sourcePriority(source),
      })),
    );
    const confluence = SourceConfluenceEngine.evaluate(eligibleSources);
    const policyUncertainties = ZcosPolicyEngine.preflight(request, executionPlan);
    const uncertainties: ZcosUncertaintyEnvelope[] = [
      ...confluence.uncertainties,
      ...policyUncertainties,
      ...(input.materialUncertainty
        ? [{
            code: "material_context_uncertainty",
            statement: "Material context uncertainty was preserved for reasoning.",
            material: true,
            confidence: intelligence.deepThinking.confidence,
            sourceIds: eligibleSources.map((source) => source.sourceId),
            resolution: "ask_user" as const,
          }]
        : []),
    ];
    stage("policy", policyUncertainties.length ? "partial" : "completed", "Safety, privacy, authorization, source-use, and external-action policy evaluated.");

    const capabilityDirective = [
      "## ZCOS Governed Execution Plan",
      `Plan: ${executionPlan.planId}`,
      `Reasoning depth: ${reasoningDepth}`,
      `External retrieval: ${external.required ? `required - ${external.reason}` : "not required; use internal sources first"}`,
      ...executionPlan.invocations.map((invocation) =>
        `- ${invocation.status.toUpperCase()} ${invocation.capabilityId} (${invocation.ownerGalaxy}; ${invocation.operation})`,
      ),
      ...executionPlan.capabilityGaps.map((gap) => `- GAP ${gap.capabilityId}: ${gap.message}`),
      "External model or source output is advisory evidence only. It cannot write Memory, Knowledge, Projects, or execution state.",
    ].join("\n");

    return {
      request,
      sources: eligibleSources,
      governedContext: ranked.prompt,
      reasoningPrompt: [intelligence.reasoningPrompt, capabilityDirective].filter(Boolean).join("\n\n"),
      responsePrompt: intelligence.responsePrompt,
      reasoningEffort: effortForDepth(reasoningDepth),
      intelligencePlan: intelligence.plan,
      executionPlan,
      uncertainties,
      trace,
      contextCompressionRatio: ranked.compressionRatio,
    };
  }

  static verifyCandidate(
    prepared: ZcosPreparedRuntime,
    result: ZcosResultEnvelope<{ text: string }>,
    additionalSources: ZcosSourceEnvelope[] = [],
    intermediateResults: ZcosResultEnvelope[] = [],
  ): ZcosVerificationEnvelope {
    const sources = [...prepared.sources, ...additionalSources];
    prepared.trace.contextSourceIds = [...new Set(sources.map((source) => source.sourceId))];
    const knownSourceIds = new Set(prepared.trace.sourceProvenance.map((source) => source.sourceId));
    prepared.trace.sourceProvenance.push(...additionalSources
      .filter((source) => !knownSourceIds.has(source.sourceId))
      .map((source) => ({
        sourceId: source.sourceId,
        type: source.type,
        authority: source.authority,
        originGalaxy: source.originGalaxy,
        originClass: source.originClass,
        confidence: source.confidence,
        currency: source.currency,
        provenance: source.provenance,
      })));
    const results = [...intermediateResults, result];
    const errors = results.flatMap((candidate) => candidate.errors);
    for (const candidate of results) {
      try {
        ZcosPolicyEngine.verifyExternalResult(candidate, sources, prepared.request.requestId);
      } catch (error) {
        errors.push({
          code: "result_policy_violation",
          stage: "verification",
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        });
      }
    }
    const confluence = SourceConfluenceEngine.evaluate(sources);
    const uncertainties = [
      ...prepared.uncertainties,
      ...results.flatMap((candidate) => candidate.uncertainties),
      ...confluence.uncertainties,
    ];
    if (prepared.executionPlan.externalRetrievalRequired && additionalSources.filter((source) => source.type.startsWith("external")).length === 0) {
      uncertainties.push({
        code: "current_source_missing",
        statement: "The plan required current external sources, but none were returned.",
        material: true,
        confidence: 1,
        sourceIds: [],
        resolution: prepared.request.intent.stakes === "high" ? "block_action" : "retrieve_current_sources",
      });
    }
    const empty = !String(result.data?.text || "").trim();
    if (empty) errors.push({ code: "empty_execution_result", stage: "verification", message: "Execution returned no presentable content.", retryable: true });
    const blocked = uncertainties.some((uncertainty) => uncertainty.material && uncertainty.resolution === "block_action");
    const status: ZcosVerificationEnvelope["status"] = errors.length
      ? "failed"
      : blocked
        ? "blocked"
        : uncertainties.length > 0 || confluence.report.conflicts.length
          ? "verified_with_uncertainty"
          : "verified";
    const verification: ZcosVerificationEnvelope = {
      status,
      checkedAt: new Date().toISOString(),
      policyChecks: [
        "authenticated_owner",
        "channel_permissions",
        "capability_certification",
        "integration_scope",
        "approval_gate",
        "source_provenance",
        "external_write_prohibition",
        "result_nonempty",
      ],
      confluence: confluence.report,
      uncertainties,
      errors,
    };
    const knownResultIds = new Set(prepared.trace.resultIds);
    for (const candidate of results) {
      if (knownResultIds.has(candidate.resultId)) continue;
      knownResultIds.add(candidate.resultId);
      prepared.trace.resultIds.push(candidate.resultId);
      prepared.trace.results.push({
        resultId: candidate.resultId,
        type: candidate.type,
        status: candidate.status,
        sourceIds: [...candidate.sourceIds],
        provenance: candidate.provenance,
        writeDisposition: candidate.writeDisposition,
      });
    }
    prepared.trace.verification = verification;
    prepared.trace.errors.push(...errors);
    prepared.trace.completedAt = verification.checkedAt;
    prepared.trace.stages.push({ engine: "verification", status: status === "failed" ? "failed" : status === "blocked" ? "blocked" : status === "verified_with_uncertainty" ? "partial" : "completed", at: verification.checkedAt, detail: status });
    return verification;
  }

  static async persistTrace(prepared: ZcosPreparedRuntime): Promise<void> {
    await ZcosExecutionTraceStore.save(prepared.trace);
  }

  static wrapExecutionResult(
    prepared: ZcosPreparedRuntime,
    text: string,
    options: { sourceIds?: string[]; errors?: ZcosResultEnvelope["errors"]; provider?: string } = {},
  ): ZcosResultEnvelope<{ text: string }> {
    return {
      schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
      resultId: randomUUID(),
      requestId: prepared.request.requestId,
      type: "execution",
      status: text.trim() ? "success" : "failed",
      data: { text },
      sourceIds: options.sourceIds || prepared.sources.map((source) => source.sourceId),
      uncertainties: [],
      errors: options.errors || [],
      provenance: {
        provider: options.provider,
        retrievedAt: new Date().toISOString(),
        independenceKey: options.provider ? `provider:${options.provider}` : "zcos:execution",
        transformation: "Execution candidate returned to ZCOS verification before ZAR presentation.",
        lineage: options.sourceIds || prepared.sources.map((source) => source.sourceId),
      },
      writeDisposition: "candidate_only",
    };
  }
}

export function capabilityGapSummary(gaps: ZcosCapabilityGap[]): string[] {
  return gaps.map((gap) => `${gap.capabilityId}: ${gap.message}`);
}
