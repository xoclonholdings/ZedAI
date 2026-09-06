import { randomUUID } from "crypto";

import { storage } from "../storage/databaseStorage";
import { insertMessageSchema } from "../../shared/schema";
import type {
  ZcosCapabilityGap,
  ZcosExecutionPlan,
  ZcosExecutionTrace,
  ZcosResultEnvelope,
  ZcosSourceEnvelope,
  ZcosVerificationEnvelope,
  ZarContextualQuestion,
} from "../../shared/zcos-intelligence";
import type { ImageBlock, ReasoningEffort } from "../core/providers/provider-interface";
import { ZarAutonomousOrchestrator } from "../zcos/orchestration/ZarAutonomousOrchestrator";
import { ZcosRequestInterpreter } from "../zcos/runtime/ZcosRequestInterpreter";
import {
  ZcosUnifiedIntelligenceRuntime,
  type ZcosPreparedRuntime,
} from "../zcos/runtime/ZcosUnifiedIntelligenceRuntime";
import { KnowledgeService } from "./KnowledgeService";
import { DocumentIntelligenceService } from "./intelligence-core/DocumentIntelligenceService";
import {
  ConversationContinuityService,
  type ConversationContinuityContext,
} from "./ConversationContinuityService";
import { ContextInquiryEngine } from "./knowledge-ingestion/ContextInquiryEngine";
import { LexiconAuthorityService } from "./lexicon-authority/LexiconAuthorityService";
import { ZarReflectionEngine } from "./ZarReflectionEngine";
import { injectMemory } from "./MemoryInjector";
import { buildWorkspaceMemoryContext } from "./WorkspaceMemoryService";
import { buildZarAdminContext } from "./ZarContextBuilder";
import { buildLearningTutorContext } from "./learning/LearningContextBuilder";
import { getZarResponsePolicy } from "./ZarResponsePolicy";
import {
  buildZarGovernancePrompt,
  userRequestedSourceLinks,
} from "./ZarResponseGovernance";
import {
  buildZarVoicePrompt,
  presentZarResponseWithChecks,
} from "./ZarVoiceFormationEngine";
import {
  extractWebTargets,
  hasWebsiteReferenceWithoutTarget,
} from "./WebContentService";
import { isWebLookupIntent } from "../orchestrator/manager-agent/agent-selection";
import { getActiveProviderName, getResolvedTargetName } from "../core/providers/provider-executor";
import { logRuntimeEvent } from "./RuntimeLogger";
import { auditTrace } from "./TraceValidator";
import { classifyChatError } from "./ErrorContract";
import { zarErrorMessage } from "../../shared/error-contract";

type ExecutionStatus = "success" | "partial" | "failed";

export interface ChatExecutionInput {
  userId: string;
  message: string;
  conversationId?: string;
  route: string;
  ip?: string;
  targetAgent?: "operations" | "research" | "business" | "finance";
  isAdmin?: boolean;
  context?: Record<string, any>;
  projectId?: string;
  workspaceId?: string;
  persistUserMessage?: boolean;
}

export interface ChatExecutionTrace {
  traceId: string;
  conversationId?: string;
  userId: string;
  route: string;
  detectedIntent?: string;
  selectedAgent?: string;
  classifierResult?: string | null;
  classifierFailed?: boolean;
  fallbackReason?: string;
  servicesInvoked: string[];
  toolsInvoked: string[];
  externalCalls: string[];
  memorySources: string[];
  projectSources: string[];
  retrievalMode?: string;
  providerUsed?: string;
  providerTarget?: string;
  reasoningEffort?: ReasoningEffort;
  presentationAdjustments: string[];
  executionStatus: ExecutionStatus;
  failureReason?: string;
  mocked: boolean;
  projectContextUsed: boolean;
  workspaceContextUsed: boolean;
  sourceCount: number;
  filesReferenced: string[];
  fileContextUsed: boolean;
  learningContextUsed: boolean;
  learningPathId?: string;
  learningLessonId?: string;
  learningSourceCount?: number;
  intelligencePlan?: import("./intelligence-core/types").IntelligenceCorePlan;
  contextCompressionRatio?: number;
  documentCitations?: string[];
  lexiconResolutions?: string[];
  conversationHistoryUsed?: boolean;
  conversationHistoryCount?: number;
  zcosRequestId?: string;
  zcosPlanId?: string;
  zcosExecutionPlan?: ZcosExecutionPlan;
  capabilityGaps?: ZcosCapabilityGap[];
  zcosVerification?: ZcosVerificationEnvelope;
  zcosTrace?: ZcosExecutionTrace;
}

export interface ChatExecutionTestHooks {
  injectedMemory?: () => Promise<{ formatted: string }>;
  contextAssessment?: () => Promise<any>;
  conversationHistory?: () => Promise<ConversationContinuityContext>;
  knowledgeContext?: () => Promise<any>;
  adminContext?: () => Promise<any>;
  fileContext?: () => Promise<{
    prompt: string;
    filesReferenced: string[];
    failedFiles: string[];
    imageBlocks?: ImageBlock[];
  }>;
  voicePrompt?: () => Promise<string>;
  route?: (request: any) => Promise<any>;
  present?: (draft: string, options: any) => Promise<{ content: string; adjustments: string[] }>;
  reflect?: (input: any) => Promise<void>;
  log?: (entry: any) => Promise<void>;
}

function emptyOutput(value: unknown): boolean {
  return !String(value || "")
    .replace(/\(no response\)/gi, "")
    .trim();
}

function hasTemplateLeakage(value: string): boolean {
  const text = String(value || "");
  return [
    /^\s*(next move|recommended action|confidence level|research brief|key findings)\s*:?/im,
    /\bnext\s+move\s*:/i,
    /\bgive me one more constraint\b/i,
    /\bturn this into (?:an executable|a cleaner|a tighter)\b/i,
    /\bproduce a report instead of a loose chat answer\b/i,
  ].some((pattern) => pattern.test(text));
}

function normalizeFailureReason(error: any, trace: ChatExecutionTrace): string {
  const message = error?.message || String(error);
  if (/lightning/i.test(message)) {
    return message;
  }
  if (/fetch failed|ECONNREFUSED|ECONNRESET|model host|provider|api[_ -]?key|not configured/i.test(message)) {
    return `modelProviderUnavailable:${trace.providerUsed || "unknown"}:${trace.providerTarget || "unknown"}`;
  }
  return message;
}

function questionOnly(question: string): string {
  const cleaned = question.trim().replace(/\s+/g, " ");
  return /[?.!]$/.test(cleaned) ? cleaned : `${cleaned}?`;
}

function compactContextAssessment(assessment: any, topQuestion: any): Record<string, unknown> {
  return {
    responsePolicy: assessment.responsePolicy,
    materialUncertainty: assessment.materialUncertainty,
    questionCount: assessment.questions.length,
    questionCategory: topQuestion.category,
    affects: Array.isArray(topQuestion.wouldChange) ? topQuestion.wouldChange : [],
  };
}

function selectTopContextQuestion(questions: any[]): any | null {
  return [...(questions || [])].sort((a, b) => b.priority - a.priority)[0] || null;
}

export function buildContextualQuestionForTest(question: any): ZarContextualQuestion {
  const supplied = Array.isArray(question?.choices)
    ? question.choices.map(String).map((choice: string) => choice.trim()).filter(Boolean).slice(0, 4)
    : [];
  const defaults: Record<string, string[]> = {
    identity: ["Yes", "No", "I'm not sure"],
    decision: ["Use the current plan", "Review options first", "I'm not sure"],
    purpose: ["Keep the current purpose", "Update it", "I'm not sure"],
    relationship: ["Directly connected", "Related context", "Not connected", "I'm not sure"],
  };
  return {
    prompt: questionOnly(String(question?.question || "What should ZAR use here?")),
    choices: supplied.length >= 2
      ? supplied
      : (defaults[String(question?.category)] || ["Yes", "No", "I'm not sure"]),
    allowFreeText: true,
  };
}

function publicTrace(trace: ChatExecutionTrace): Record<string, unknown> {
  return {
    traceId: trace.traceId,
    executionStatus: trace.executionStatus,
    ...(trace.failureReason ? { failureReason: trace.failureReason } : {}),
    ...(trace.zcosRequestId ? { requestId: trace.zcosRequestId } : {}),
    ...(trace.zcosPlanId ? { planId: trace.zcosPlanId } : {}),
  };
}

function publicErrorDetail(errorDetail: Record<string, any>): Record<string, unknown> {
  return {
    code: errorDetail.code,
    userMessage: errorDetail.userMessage,
    exactReason: errorDetail.exactReason,
    action: errorDetail.action,
  };
}

function publicResponseMetadata(
  trace: ChatExecutionTrace,
  managerMetadata: Record<string, any>,
  requiresApproval: boolean,
): Record<string, unknown> {
  const assignments = trace.zcosExecutionPlan?.assignments || [];
  const blockers = [
    ...(trace.capabilityGaps || []).map((gap) => gap.message),
    ...(trace.failureReason ? [trace.failureReason] : []),
  ].filter(Boolean);
  const taskState = trace.executionStatus === "failed"
    ? "failed"
    : trace.executionStatus === "partial"
      ? "partial"
      : assignments[0]?.status || "completed";
  const evidenceLinks = Array.isArray(managerMetadata?.web?.pages)
    ? managerMetadata.web.pages
        .map((page: any) => ({
          title: String(page?.title || page?.url || "Source"),
          url: String(page?.url || ""),
        }))
        .filter((page: any) => /^https?:\/\//i.test(page.url))
    : [];
  const uncertainties = (trace.zcosVerification?.uncertainties || []).map((item) => ({
    statement: item.statement,
    material: item.material,
    resolution: item.resolution,
  }));
  const dissent = (trace.zcosVerification?.confluence.conflicts || []).map((conflict) => ({
    claim: conflict.claimKey,
    values: conflict.values.map((value) => value.value),
  }));
  return {
    agent: "ZAR",
    responseForm: trace.zcosExecutionPlan?.responseForm || "direct_answer",
    taskState,
    assignments,
    requiresApproval,
    approvalStatus: requiresApproval ? "required" : "not_required",
    blockers,
    uncertainties,
    dissent,
    evidenceLinks,
    documentCitations: trace.documentCitations || [],
    ...(Array.isArray(managerMetadata.clientActions) ? { clientActions: managerMetadata.clientActions } : {}),
    ...(Array.isArray(managerMetadata.nexysClientActions)
      ? { nexysClientActions: managerMetadata.nexysClientActions }
      : {}),
    execution: publicTrace(trace),
  };
}

function findPriorWebUrlFromMetadata(history: any[]): string | undefined {
  for (const message of [...history].reverse()) {
    const metadata = message?.metadata || {};
    const candidates = [
      ...(metadata?.web?.pages || []),
      ...(metadata?.brief?.web?.pages || []),
      ...(metadata?.executionTrace?.webPages || []),
    ];
    const page = candidates.find((candidate: any) => candidate?.url);
    if (page?.url) return page.url;
  }
  return undefined;
}

export function resolveReferencedWebpageForTest(content: string, history: any[]): string {
  if (extractWebTargets(content).length > 0) return content;
  if (!hasWebsiteReferenceWithoutTarget(content)) return content;

  const metadataUrl = findPriorWebUrlFromMetadata(history);
  if (metadataUrl) {
    return `${content}\n\nReferenced webpage from conversation metadata: ${metadataUrl}`;
  }

  for (const message of [...history].reverse()) {
    const target = extractWebTargets(String(message?.content || ""))[0];
    if (target?.url) {
      return `${content}\n\nReferenced webpage from recent conversation: ${target.url}`;
    }
  }

  return content;
}

async function buildFileContext(conversationId?: string): Promise<{
  prompt: string;
  filesReferenced: string[];
  failedFiles: string[];
  imageBlocks: ImageBlock[];
}> {
  if (!conversationId)
    return { prompt: "", filesReferenced: [], failedFiles: [], imageBlocks: [] };
  const files = await storage.getFilesByConversation(conversationId).catch(() => []);
  const usable = files.filter((file: any) => file.status === "completed" && file.extractedContent);
  const failed = files
    .filter((file: any) => file.status === "error")
    .map((file: any) => file.originalName || file.fileName);
  if (usable.length === 0)
    return { prompt: "", filesReferenced: [], failedFiles: failed, imageBlocks: [] };

  const isImage = (file: any) =>
    typeof file.mimeType === "string" && file.mimeType.startsWith("image/");

  const imageFiles = usable.filter(isImage).slice(0, 6);
  const textFiles = usable.filter((f: any) => !isImage(f)).slice(0, 6);

  const imageBlocks: ImageBlock[] = imageFiles.map((file: any) => ({
    type: "image",
    data: String(file.extractedContent || ""),
    mediaType: file.mimeType,
  }));

  const lines: string[] = [];
  if (imageFiles.length > 0) {
    lines.push(
      `### Attached images\n${imageFiles
        .map((f: any) => `- ${f.originalName || f.fileName}`)
        .join("\n")}\nThe images themselves are attached to this message; look at them directly.`,
    );
  }
  for (const file of textFiles) {
    const content = String(file.extractedContent || "").slice(0, 8_000);
    lines.push(
      `### ${file.originalName || file.fileName}\nStatus: ${file.status}\nContent:\n${content}`,
    );
  }

  return {
    prompt: `## UPLOADED FILE CONTEXT\nUse this content before general knowledge when the user asks about uploaded files.\n\n${lines.join("\n\n")}`,
    filesReferenced: [...imageFiles, ...textFiles].map((file: any) => file.originalName || file.fileName),
    failedFiles: failed,
    imageBlocks,
  };
}

async function saveAssistantMessage(
  conversationId: string | undefined,
  content: string,
  metadata: Record<string, any>,
) {
  if (!conversationId) return null;
  if (emptyOutput(content)) throw new Error("assistant_output_empty");
  return storage.createMessage(
    insertMessageSchema.parse({
      conversationId,
      role: "assistant",
      content,
      metadata,
    }),
  );
}

function sourceEnvelope(
  requestId: string,
  input: {
    id: string;
    type: ZcosSourceEnvelope["type"];
    title: string;
    content: string;
    authority?: ZcosSourceEnvelope["authority"];
    originClass?: ZcosSourceEnvelope["originClass"];
    originGalaxy?: ZcosSourceEnvelope["originGalaxy"];
    confidence?: number;
    currency?: ZcosSourceEnvelope["currency"];
  },
): ZcosSourceEnvelope | null {
  if (!input.content?.trim()) return null;
  return {
    sourceId: `${requestId}:${input.id}`,
    type: input.type,
    authority: input.authority || "candidate",
    originGalaxy: input.originGalaxy || "ZCOS",
    originClass: input.originClass || "internal_canonical",
    title: input.title,
    content: input.content,
    confidence: input.confidence ?? 0.6,
    currency: input.currency || "unknown",
    provenance: {
      sourceRecordId: input.id,
      retrievedAt: new Date().toISOString(),
      independenceKey: `zcos:${input.id}`,
      lineage: [requestId, input.id],
    },
  };
}

export class ChatExecutionService {
  static async execute(input: ChatExecutionInput, hooks: ChatExecutionTestHooks = {}): Promise<Record<string, any>> {
    let preparedRuntime: ZcosPreparedRuntime | undefined;
    const trace: ChatExecutionTrace = {
      traceId: randomUUID(),
      conversationId: input.conversationId,
      userId: input.userId,
      route: input.route,
      servicesInvoked: [],
      toolsInvoked: [],
      externalCalls: [],
      memorySources: [],
      projectSources: [],
      presentationAdjustments: [],
      executionStatus: "success",
      mocked: false,
      projectContextUsed: false,
      workspaceContextUsed: Boolean(input.workspaceId),
      sourceCount: 0,
      filesReferenced: [],
      fileContextUsed: false,
      learningContextUsed: false,
      providerUsed: getActiveProviderName({ lane: "chat" }),
      providerTarget: getResolvedTargetName({ lane: "chat" }),
    };

    try {
      if (!input.message?.trim()) {
        trace.executionStatus = "failed";
        trace.failureReason = "message_required";
        return {
          error: "message_required",
          reply: "Message required.",
          agent: "ZAR",
          metadata: { execution: publicTrace(trace) },
          trace: publicTrace(trace),
        };
      }

      if (input.persistUserMessage !== false && input.conversationId) {
        await storage.createMessage(
          insertMessageSchema.parse({
            conversationId: input.conversationId,
            role: "user",
            content: input.message,
          }),
        );
      }

      const history = input.conversationId
        ? await storage.getMessagesByConversation(input.conversationId).catch(() => [])
        : [];
      const effectiveMessage = resolveReferencedWebpageForTest(input.message, history);
      const channelPermissions = input.context?.channelPermissions as
        | { memory?: boolean; knowledge?: boolean; projects?: boolean; conversationHistory?: boolean }
        | undefined;
      const memoryAllowed = channelPermissions?.memory !== false;
      const knowledgeAllowed = channelPermissions?.knowledge !== false;
      const projectsAllowed = channelPermissions?.projects !== false;
      const conversationHistoryAllowed = channelPermissions?.conversationHistory !== false;
      const conversationHistory = hooks.conversationHistory
        ? await hooks.conversationHistory()
        : await ConversationContinuityService.retrieve({
            userId: input.userId,
            message: input.message,
            currentConversationId: input.conversationId,
            projectId: input.projectId || input.context?.projectId,
            enabled: conversationHistoryAllowed,
          }).catch(() => ({
            assumesSharedContext: false,
            prompt: "",
            evidence: [],
            lookup: { topicTerms: [], entities: [], projectIds: [] },
          }));
      trace.conversationHistoryUsed = Boolean(conversationHistory.prompt);
      trace.conversationHistoryCount = conversationHistory.evidence.length;
      if (conversationHistory.prompt) {
        trace.servicesInvoked.push("ConversationContinuityService.retrieve");
      }
      const zcosRequest = ZcosRequestInterpreter.interpret({
        traceId: trace.traceId,
        userId: input.userId,
        message: effectiveMessage,
        route: input.route,
        conversationId: input.conversationId,
        projectId: input.projectId || input.context?.projectId,
        workspaceId: input.workspaceId || input.context?.workspaceId,
        // Capability selection belongs to ZCOS; client context cannot force a specialist.
        requestedCapabilityIds: undefined,
        channelPermissions,
        // Never accept action authorization from client-supplied context.
        // Action-specific approval must arrive through the server approval boundary.
        externalActionsAuthorized: false,
        authenticationSource: input.route === "sms" ? "verified_channel_binding" : "authenticated_session",
      });
      trace.zcosRequestId = zcosRequest.requestId;
      const webLookupIntent = isWebLookupIntent(effectiveMessage) || isWebLookupIntent(input.message);
      trace.detectedIntent = webLookupIntent ? "web_research" : "manager";

      // Lexicon Authority runs first, ahead of Context Inquiry, per
      // SPEC.md § Reasoning Pipeline: User Input -> Lexicon Authority ->
      // Intent Interpretation -> Knowledge Assembly -> Reasoning ->
      // Response. It interprets slang, community language, acronyms,
      // and project/product terminology in the raw message so the rest
      // of the Cognitive Core reasons over meaning, not just text.
      trace.servicesInvoked.push("LexiconAuthorityService.resolveText");
      const lexiconResolution = await LexiconAuthorityService.resolveText(effectiveMessage, {
        userId: input.userId,
        workspaceId: input.workspaceId || input.context?.workspaceId,
      }).catch(() => ({ prompt: "", resolutions: [], unresolvedSignals: [] as string[] }));
      if (lexiconResolution.resolutions.length > 0) {
        trace.memorySources.push("LexiconAuthority");
        trace.lexiconResolutions = lexiconResolution.resolutions.map((resolution) => resolution.term);
      }
      // Discovery: quote/definition-style signals ("what does X mean",
      // 'X') that the lexicon doesn't recognize become low-confidence
      // candidates with this turn as evidence. Never promoted on one
      // occurrence — see LexiconAuthorityService.registerCandidate.
      if (memoryAllowed) {
        for (const term of lexiconResolution.unresolvedSignals.slice(0, 3)) {
          LexiconAuthorityService.registerCandidate({
            term,
            evidenceExcerpt: effectiveMessage.slice(0, 480),
            sourceLabel: input.route === "sms" ? "sms_unresolved_signal" : "chat_unresolved_signal",
            userId: input.userId,
            conversationId: input.conversationId,
          }).catch(() => null);
        }
      }

      let contextInquiryPrompt = "";
      let contextMaterialUncertainty = false;

      // If Context Inquiry finds a genuinely high-priority missing fact
      // AND the previous assistant turn wasn't itself a clarifying
      // question, we short-circuit the whole cognitive core and return
      // the question as ZAR's reply. That's what makes ZAR feel like
      // it's actually reasoning: on a clear "I need to know X before I
      // can answer well" it pauses instead of blindly answering.
      let pauseAndAsk: {
        reply: string;
        question: any;
        assessment: any;
      } | null = null;

      if (memoryAllowed && !webLookupIntent) {
        try {
          trace.servicesInvoked.push("ContextInquiryEngine.assess");
          const contextAssessmentResult = hooks.contextAssessment
            ? await hooks.contextAssessment()
            : await ContextInquiryEngine.assess({ userInput: input.message });
          const assessment = contextAssessmentResult.assessment;
          const topQuestion = selectTopContextQuestion(assessment.questions);

          contextMaterialUncertainty = Boolean(assessment.materialUncertainty);

          if (assessment.responsePolicy === "inquire_first" && topQuestion) {
            contextInquiryPrompt = [
              "## Context Inquiry Signal",
              "Stored context has material uncertainty. Do not stop with a canned clarification.",
              "Proceed with the best grounded answer when possible. Ask exactly one specific question only if the missing fact would make execution wrong.",
              `Top missing fact: ${questionOnly(topQuestion.question)}`,
              `Context assessment: ${JSON.stringify(compactContextAssessment(assessment, topQuestion))}`,
            ].join("\n");
            trace.fallbackReason = "context_inquiry_used_as_reasoning_signal";

            // 0.86 matches the priority threshold ContextInquiryEngine
            // uses internally to consider a question strong enough to
            // flag as material uncertainty. Below that, we still
            // inject the question as a reasoning signal (above), but
            // let the model decide how to weight it.
            const priorityHighEnough = Number(topQuestion.priority) >= 0.86;
            // Only surface questions the USER can actually answer about
            // their intent. Graph-bookkeeping categories (status,
            // confidence, priority, importance, history) produce
            // internal-sounding prompts like "Is X current, historical,
            // rejected, or superseded?" — the user has no way to answer
            // those. They still feed reasoning via contextInquiryPrompt
            // above; they just must never hijack the reply.
            const USER_ANSWERABLE = new Set(["identity", "purpose", "decision", "relationship"]);
            const categoryIsUserFacing = USER_ANSWERABLE.has(String(topQuestion.category));
            // Don't ask twice in a row — if the previous assistant
            // message was itself a clarifying question, the user just
            // answered it, and it would be a bad experience to
            // immediately pause again on a new tangent.
            const priorAssistant = [...history]
              .slice(0, -1)
              .reverse()
              .find((m: any) => m.role === "assistant");
            const priorWasClarifying =
              Boolean(priorAssistant?.metadata?.clarifyingQuestion) === true;

            if (priorityHighEnough && categoryIsUserFacing && !priorWasClarifying) {
              pauseAndAsk = {
                reply: questionOnly(topQuestion.question),
                question: topQuestion,
                assessment,
              };
            }
          }
        } catch (error: any) {
          trace.executionStatus = "partial";
          trace.fallbackReason = `context_inquiry_failed:${error?.message || String(error)}`;
          await (hooks.log || logRuntimeEvent)({
            level: "warn",
            source: "server",
            event: "chat.context_inquiry.failed",
            detail: error?.message || String(error),
            context: { traceId: trace.traceId, conversationId: input.conversationId },
          });
        }
      }

      // Short-circuit for pause-and-ask. Everything below (memory,
      // knowledge, admin context, principle, strategic, voice, model
      // call, presentation, reflection) is skipped — we save the
      // question as a normal assistant message with metadata that
      // marks it as clarifying so downstream (this loop, next turn)
      // can detect it.
      if (pauseAndAsk) {
        const { reply, question } = pauseAndAsk;
        trace.executionStatus = "success";
        trace.detectedIntent = "clarify";
        trace.selectedAgent = "ContextInquiryEngine";
        trace.fallbackReason = "context_inquiry_paused_and_asked";

        preparedRuntime = ZcosUnifiedIntelligenceRuntime.prepare({
          request: zcosRequest,
          sources: [],
          strategic: false,
          materialUncertainty: true,
          hasFiles: false,
          hasGraphContext: false,
          hasMemory: true,
          clarificationOnly: true,
        });
        const clarificationResult = ZcosUnifiedIntelligenceRuntime.wrapExecutionResult(preparedRuntime, reply);
        trace.zcosVerification = ZcosUnifiedIntelligenceRuntime.verifyCandidate(preparedRuntime, clarificationResult);
        trace.zcosPlanId = preparedRuntime.executionPlan.planId;
        trace.zcosExecutionPlan = preparedRuntime.executionPlan;
        trace.capabilityGaps = preparedRuntime.executionPlan.capabilityGaps;
        trace.zcosTrace = preparedRuntime.trace;
        await ZcosUnifiedIntelligenceRuntime.persistTrace(preparedRuntime);

        const metadata = {
          agent: "ZAR",
          actionType: "clarifying_question",
          clarifyingQuestion: true,
          contextualQuestion: buildContextualQuestionForTest(question),
          responseForm: preparedRuntime.executionPlan.responseForm,
          taskState: "completed",
          requiresApproval: false,
          approvalStatus: "not_required",
          blockers: [],
          uncertainties: [],
          dissent: [],
          evidenceLinks: [],
          execution: publicTrace(trace),
        };

        await saveAssistantMessage(input.conversationId, reply, metadata).catch(() => null);

        await (hooks.log || logRuntimeEvent)({
          level: "info",
          source: "server",
          event: "chat.context_inquiry.paused",
          detail: `Paused to ask: ${reply.slice(0, 120)}`,
          context: {
            traceId: trace.traceId,
            conversationId: input.conversationId,
            questionPriority: Number(question.priority),
            questionCategory: question.category,
          },
        });

        return {
          reply,
          agent: "ZAR",
          metadata,
          trace: publicTrace(trace),
        };
      }

      const injectedMemory = !memoryAllowed
        ? { formatted: "" }
        : hooks.injectedMemory
          ? await hooks.injectedMemory()
          : await injectMemory("ZCOS", {
              includeFoundation: Boolean(input.isAdmin),
              userId: input.userId,
            }).catch(() => ({ formatted: "" }));
      if (injectedMemory.formatted) trace.memorySources.push("MemoryInjector");

      // Workspace memory FIRST: whenever a request comes from a workspace,
      // ZAR grounds in that workspace's own knowledge before any other work.
      const workspaceSlug = String(
        input.workspaceId || input.context?.workspaceId || "",
      ).trim();
      const workspaceMemory = !memoryAllowed || !projectsAllowed
        ? { prompt: "", count: 0, used: false }
        : await buildWorkspaceMemoryContext(
            workspaceSlug,
            effectiveMessage,
            input.userId,
            Boolean(input.isAdmin),
          ).catch(() => ({ prompt: "", count: 0, used: false }));
      if (workspaceMemory.used) trace.memorySources.push("WorkspaceMemory");

      if (knowledgeAllowed) trace.servicesInvoked.push("KnowledgeService.buildContext");
      const knowledge = !knowledgeAllowed
        ? { prompt: "", retrievalMode: "channel_permission_disabled" }
        : hooks.knowledgeContext
          ? await hooks.knowledgeContext()
          : await KnowledgeService.buildContext({
              userId: input.userId,
              query: effectiveMessage,
              conversationId: input.conversationId,
              lane: "manager",
              injectedMemory: injectedMemory.formatted,
              includeAdminFoundation: Boolean(input.isAdmin),
            });
      trace.retrievalMode = (knowledge as any).retrievalMode || "knowledge_context";
      if (knowledge.prompt) trace.memorySources.push("KnowledgeService");

      if (projectsAllowed) trace.servicesInvoked.push("buildZarAdminContext");
      const adminContext = !projectsAllowed
        ? { text: "", meta: { projectInstructions: false, projectSourceCount: 0 } }
        : hooks.adminContext
          ? await hooks.adminContext()
          : await buildZarAdminContext({
              userId: input.userId,
              conversationId: input.conversationId,
              projectId: input.projectId || input.context?.projectId,
              workspaceId: input.workspaceId || input.context?.workspaceId,
            } as any);
      trace.projectContextUsed = Boolean(adminContext.meta.projectInstructions || adminContext.meta.projectSourceCount);
      trace.projectSources = adminContext.meta.projectSourceCount ? ["ProjectFilingStore"] : [];
      trace.sourceCount = adminContext.meta.projectSourceCount || 0;

      const fileContext = !knowledgeAllowed
        ? { prompt: "", filesReferenced: [], failedFiles: [], imageBlocks: [] }
        : hooks.fileContext
          ? await hooks.fileContext()
          : await buildFileContext(input.conversationId);
      trace.filesReferenced = fileContext.filesReferenced;
      trace.fileContextUsed = Boolean(fileContext.prompt);
      if (fileContext.prompt) trace.memorySources.push("conversation_files");
      if (fileContext.failedFiles.length > 0) {
        trace.executionStatus = trace.executionStatus === "success" ? "partial" : trace.executionStatus;
        trace.failureReason = `file_processing_failed:${fileContext.failedFiles.join(",")}`;
      }

      let learningContext = { prompt: "", sourceCount: 0, masteryCount: 0 } as Awaited<ReturnType<typeof buildLearningTutorContext>>;
      const learningPathId =
        typeof input.context?.learningPathId === "string"
          ? input.context.learningPathId
          : undefined;
      const learningLessonId =
        typeof input.context?.lessonId === "string"
          ? input.context.lessonId
          : undefined;
      if (knowledgeAllowed && learningPathId) {
        trace.servicesInvoked.push("LearningContextBuilder.buildLearningTutorContext");
        learningContext = await buildLearningTutorContext({
          userId: input.userId,
          pathId: learningPathId,
          lessonId: learningLessonId,
        }).catch(() => ({ prompt: "", sourceCount: 0, masteryCount: 0 }));
        trace.learningContextUsed = Boolean(learningContext.prompt);
        trace.learningPathId = learningContext.pathId || learningPathId;
        trace.learningLessonId = learningContext.lessonId || learningLessonId;
        trace.learningSourceCount = learningContext.sourceCount || 0;
        if (learningContext.prompt) trace.memorySources.push("learning_studio");
      }

      const governancePrompt = buildZarGovernancePrompt({
        userMessage: effectiveMessage,
        lane: "manager",
        knowledgePresent: Boolean(knowledge.prompt || adminContext.text || fileContext.prompt || learningContext.prompt),
      });

      // Document Intelligence — surface knowledge extracted from uploaded
      // and previously-ingested documents (connected in the knowledge
      // graph) with source attribution. Best-effort; never blocks a reply.
      if (knowledgeAllowed) trace.servicesInvoked.push("DocumentIntelligenceService.retrieveForQuery");
      const documentKnowledge = !knowledgeAllowed
        ? { block: "", objectIds: [], citations: [], conflictCount: 0 }
        : await DocumentIntelligenceService.retrieveForQuery(
            effectiveMessage,
          ).catch(() => ({ block: "", objectIds: [], citations: [], conflictCount: 0 }));
      if (documentKnowledge.objectIds.length > 0) {
        trace.memorySources.push("DocumentKnowledgeGraph");
        trace.documentCitations = documentKnowledge.citations;
      }

      const zcosSources = [
        sourceEnvelope(zcosRequest.requestId, { id: "identity-lexicon", type: "identity", title: "Lexicon authority", content: lexiconResolution.prompt, confidence: 0.7, currency: "current" }),
        sourceEnvelope(zcosRequest.requestId, { id: "conversation-history", type: "conversation_history", title: "Authorized conversation history", content: conversationHistory.prompt, authority: "source", originGalaxy: "ZAR", originClass: "user_supplied", confidence: 0.75, currency: "historical" }),
        sourceEnvelope(zcosRequest.requestId, { id: "memory-injected", type: "memory", title: "Authorized memory", content: injectedMemory.formatted, confidence: 0.55 }),
        sourceEnvelope(zcosRequest.requestId, { id: "memory-workspace", type: "memory", title: "Workspace memory", content: workspaceMemory.prompt, authority: "canonical", confidence: 0.85, currency: "current" }),
        sourceEnvelope(zcosRequest.requestId, { id: "knowledge", type: "knowledge", title: "Knowledge context", content: knowledge.prompt, confidence: 0.65 }),
        sourceEnvelope(zcosRequest.requestId, { id: "project", type: "project", title: "Project context", content: adminContext.text, authority: "canonical", confidence: 0.9, currency: "current" }),
        sourceEnvelope(zcosRequest.requestId, { id: "files", type: "file", title: "User-provided files", content: fileContext.prompt, originGalaxy: "ZAR", originClass: "user_supplied", confidence: 0.95, currency: "current" }),
        sourceEnvelope(zcosRequest.requestId, { id: "learning", type: "learning", title: "Learning context", content: learningContext.prompt, confidence: 0.75 }),
        sourceEnvelope(zcosRequest.requestId, { id: "document-graph", type: "knowledge", title: "Document knowledge graph", content: documentKnowledge.block, confidence: 0.75 }),
      ].filter((source): source is ZcosSourceEnvelope => Boolean(source));

      trace.servicesInvoked.push("ZcosUnifiedIntelligenceRuntime.prepare");
      preparedRuntime = ZcosUnifiedIntelligenceRuntime.prepare({
        request: zcosRequest,
        sources: zcosSources,
        strategic: false,
        materialUncertainty: contextMaterialUncertainty,
        hasFiles: Boolean(fileContext.prompt),
        hasGraphContext: documentKnowledge.objectIds.length > 0,
        hasMemory: Boolean(knowledge.prompt || injectedMemory.formatted || learningContext.prompt),
      });
      trace.intelligencePlan = preparedRuntime.intelligencePlan;
      trace.reasoningEffort = preparedRuntime.reasoningEffort;
      trace.contextCompressionRatio = preparedRuntime.contextCompressionRatio;
      trace.zcosPlanId = preparedRuntime.executionPlan.planId;
      trace.zcosExecutionPlan = preparedRuntime.executionPlan;
      trace.capabilityGaps = preparedRuntime.executionPlan.capabilityGaps;
      trace.zcosTrace = preparedRuntime.trace;
      const knowledgeBlock = preparedRuntime.governedContext;
      const voiceMode = preparedRuntime.intelligencePlan.complexity === "deep" ||
        preparedRuntime.intelligencePlan.complexity === "complex"
        ? "strategy"
        : "chat";
      const voicePrompt = hooks.voicePrompt
        ? await hooks.voicePrompt()
        : await buildZarVoicePrompt({ mode: voiceMode });

      // ZAR supplies relationship, interaction, and presentation policy.
      // ZCOS supplies governed context, reasoning, planning, capability
      // routing, policy, and verification through the typed runtime.
      const cognitiveKnowledgePrompt = [
        governancePrompt,
        lexiconResolution.prompt,
        contextInquiryPrompt,
        // Workspace memory sits ahead of general knowledge so ZAR always
        // works from the workspace's own library first.
        workspaceMemory.prompt,
        preparedRuntime.reasoningPrompt,
        knowledgeBlock,
        preparedRuntime.responsePrompt,
        voicePrompt,
        getZarResponsePolicy(voiceMode),
      ]
        .filter(Boolean)
        .join("\n\n");

      trace.servicesInvoked.push("ZarAutonomousOrchestrator.route");
      const routeRequest = {
        userId: input.userId,
        message: effectiveMessage,
        conversationId: input.conversationId,
        ip: input.ip || "",
        context: {
          ...(input.context || {}),
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          knowledgePrompt: cognitiveKnowledgePrompt,
          reasoningEffort: preparedRuntime.reasoningEffort,
          isAdmin: Boolean(input.isAdmin),
          attachments: fileContext.imageBlocks || [],
          zcosRequest,
          zcosExecutionPlan: preparedRuntime.executionPlan,
          zcosSources,
          traceId: trace.traceId,
        },
      };
      const response = hooks.route
        ? await hooks.route(routeRequest)
        : await ZarAutonomousOrchestrator.route(routeRequest);

      const upstreamEmpty = emptyOutput(response.reply);
      const upstreamTemplate = !upstreamEmpty && hasTemplateLeakage(response.reply);
      if (upstreamEmpty || upstreamTemplate) {
        trace.executionStatus = "failed";
        trace.failureReason = upstreamEmpty ? "upstream_empty_output" : "upstream_template_output";
      }

      const managerMetadata = response.metadata || {};
      const additionalSources = Array.isArray(managerMetadata.zcosSources)
        ? managerMetadata.zcosSources as ZcosSourceEnvelope[]
        : [];
      const intermediateResults = Array.isArray(managerMetadata.intermediateResults)
        ? managerMetadata.intermediateResults as ZcosResultEnvelope[]
        : [];
      const executionResult = managerMetadata.externalResult || ZcosUnifiedIntelligenceRuntime.wrapExecutionResult(
        preparedRuntime,
        response.reply,
        {
          sourceIds: [...zcosSources, ...additionalSources].map((source) => source.sourceId),
          provider: managerMetadata.executionProvider || trace.providerUsed,
        },
      );
      trace.zcosVerification = ZcosUnifiedIntelligenceRuntime.verifyCandidate(
        preparedRuntime,
        executionResult,
        additionalSources,
        intermediateResults,
      );
      trace.zcosTrace = preparedRuntime.trace;
      const verificationMaterialUncertainty = trace.zcosVerification.uncertainties
        .find((uncertainty) => uncertainty.material)?.statement;
      if (trace.zcosVerification.status === "failed" || trace.zcosVerification.status === "blocked") {
        trace.executionStatus = "failed";
        trace.failureReason = trace.zcosVerification.errors[0]?.message ||
          verificationMaterialUncertainty ||
          `zcos_verification_${trace.zcosVerification.status}`;
      } else if (
        trace.zcosVerification.status === "verified_with_uncertainty" &&
        trace.zcosVerification.uncertainties.some((uncertainty) => uncertainty.material)
      ) {
        trace.executionStatus = "partial";
        trace.failureReason = verificationMaterialUncertainty;
      }

      const presented = await (hooks.present || presentZarResponseWithChecks)(
        trace.executionStatus === "failed"
          ? `Execution failed: ${trace.failureReason}.`
          : verificationMaterialUncertainty
            ? `Verification note: ${verificationMaterialUncertainty}\n\n${response.reply}`
            : response.reply,
        {
          userMessage: input.message,
          includeSources: userRequestedSourceLinks(input.message),
          mode: voiceMode,
          grounded: true,
        },
      );
      trace.presentationAdjustments.push(...presented.adjustments);

      if (emptyOutput(presented.content)) {
        trace.executionStatus = "failed";
        trace.failureReason = "presentation_removed_all_output";
      }

      await ZcosUnifiedIntelligenceRuntime.persistTrace(preparedRuntime);
      trace.detectedIntent = managerMetadata.intent || trace.detectedIntent;
      trace.selectedAgent = response.agent || managerMetadata.selectedAgent;
      trace.classifierResult = managerMetadata.classifierResult;
      trace.classifierFailed = managerMetadata.classifierFailed;
      trace.fallbackReason = managerMetadata.fallbackReason || trace.fallbackReason;
      trace.servicesInvoked = Array.from(new Set([...trace.servicesInvoked, ...(managerMetadata.servicesInvoked || [])]));
      trace.toolsInvoked = Array.from(new Set([...trace.toolsInvoked, ...(managerMetadata.toolsInvoked || [])]));
      trace.externalCalls = Array.from(new Set([
        ...trace.externalCalls,
        ...(managerMetadata.web?.pages?.length ? ["direct_url_fetch"] : []),
        ...(managerMetadata.externalResult?.provenance?.provider
          ? [`provider:${managerMetadata.externalResult.provenance.provider}`]
          : []),
        ...additionalSources
          .map((source) => source.provenance.provider)
          .filter((provider): provider is string => Boolean(provider))
          .map((provider) => `source:${provider}`),
      ]));

      const metadata = publicResponseMetadata(
        trace,
        managerMetadata,
        Boolean(response.requiresApproval),
      );

      await saveAssistantMessage(input.conversationId, presented.content, {
        agent: "ZAR",
        requiresApproval: response.requiresApproval,
        ...metadata,
      });

      if (memoryAllowed) {
        await (hooks.reflect || ZarReflectionEngine.reflectAfterReply)({
          userId: input.userId,
          conversationId: input.conversationId,
          userMessage: input.message,
          assistantReply: presented.content,
          route: "orchestrate",
          strategic: voiceMode === "strategy",
          requiresApproval: response.requiresApproval,
          tags: [input.route === "sms" ? "sms" : "orchestrate", "cognitive-core", trace.selectedAgent || "unknown-agent"],
        }).catch((error) => {
          void (hooks.log || logRuntimeEvent)({
            level: "warn",
            source: "server",
            event: "reflection.failed",
            detail: error?.message || String(error),
            context: { traceId: trace.traceId, conversationId: input.conversationId },
          });
        });
      }

      auditTrace(trace as any);
      await (hooks.log || logRuntimeEvent)({
        level: trace.executionStatus === "failed" ? "error" : "info",
        source: "server",
        event: "chat.execution.trace",
        detail: `${trace.route} -> ${trace.selectedAgent || "unknown"} -> ${trace.executionStatus}`,
        context: trace as any,
      });

      return {
        reply: presented.content,
        agent: "ZAR",
        requiresApproval: Boolean(response.requiresApproval),
        metadata,
        trace: publicTrace(trace),
      };
    } catch (error: any) {
      trace.executionStatus = "failed";
      trace.failureReason = normalizeFailureReason(error, trace);
      if (preparedRuntime && !preparedRuntime.trace.completedAt) {
        const failedResult = ZcosUnifiedIntelligenceRuntime.wrapExecutionResult(preparedRuntime, "", {
          errors: [{
            code: "execution_failed",
            stage: "orchestration",
            message: trace.failureReason,
            retryable: false,
          }],
          provider: trace.providerUsed,
        });
        trace.zcosVerification = ZcosUnifiedIntelligenceRuntime.verifyCandidate(preparedRuntime, failedResult);
        trace.zcosTrace = preparedRuntime.trace;
        await ZcosUnifiedIntelligenceRuntime.persistTrace(preparedRuntime).catch(() => undefined);
      }
      const errorDetail = classifyChatError(error, {
        provider: trace.providerUsed,
        target: trace.providerTarget,
      });
      const safeErrorDetail = publicErrorDetail(errorDetail);
      await (hooks.log || logRuntimeEvent)({
        level: "error",
        source: "server",
        event: "chat.execution.failed",
        detail: trace.failureReason,
        context: { traceId: trace.traceId, conversationId: input.conversationId, errorDetail },
      });
      const failureReply = zarErrorMessage(errorDetail, `Execution failed: ${trace.failureReason}.`);
      await saveAssistantMessage(input.conversationId, failureReply, {
        agent: "ZAR",
        executionStatus: trace.executionStatus,
        failureReason: trace.failureReason,
        errorDetail: safeErrorDetail,
        execution: publicTrace(trace),
      }).catch(() => null);
      return {
        error: "execution_failed",
        reply: failureReply,
        agent: "ZAR",
        metadata: {
          executionStatus: trace.executionStatus,
          failureReason: trace.failureReason,
          errorDetail: safeErrorDetail,
          execution: publicTrace(trace),
        },
        errorDetail: safeErrorDetail,
        trace: publicTrace(trace),
      };
    }
  }
}

export default ChatExecutionService;
