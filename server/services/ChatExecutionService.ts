import { randomUUID } from "crypto";

import { storage } from "../storage/databaseStorage";
import { insertMessageSchema } from "../../shared/schema";
import type { ImageBlock } from "../core/providers/provider-interface";
import { ZedAutonomousOrchestrator } from "../zcos/orchestration/ZedAutonomousOrchestrator";
import { KnowledgeService } from "./KnowledgeService";
import { IntelligenceCore } from "./intelligence-core";
import { ContextIntelligenceEngine } from "./intelligence-core/ContextIntelligenceEngine";
import { DocumentIntelligenceService } from "./intelligence-core/DocumentIntelligenceService";
import { ContextInquiryEngine } from "./knowledge-ingestion/ContextInquiryEngine";
import { ZedPrincipleEngine } from "./ZedPrincipleEngine";
import { ZedStrategicReasoningEngine } from "./ZedStrategicReasoningEngine";
import { ZedReflectionEngine } from "./ZedReflectionEngine";
import { injectMemory } from "./MemoryInjector";
import { buildZedAdminContext } from "./ZedContextBuilder";
import { getZedResponsePolicy } from "./ZedResponsePolicy";
import {
  buildZedGovernancePrompt,
  userRequestedSourceLinks,
} from "./ZedResponseGovernance";
import {
  buildZedVoicePrompt,
  presentZedResponseWithChecks,
} from "./ZedVoiceFormationEngine";
import {
  extractWebTargets,
  hasWebsiteReferenceWithoutTarget,
} from "./WebContentService";
import { isWebLookupIntent } from "../orchestrator/manager-agent/agent-selection";
import { getActiveProviderName, getResolvedTargetName } from "../core/providers/provider-executor";
import { logRuntimeEvent } from "./RuntimeLogger";
import { auditTrace } from "./TraceValidator";

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
  presentationAdjustments: string[];
  executionStatus: ExecutionStatus;
  failureReason?: string;
  mocked: boolean;
  projectContextUsed: boolean;
  workspaceContextUsed: boolean;
  sourceCount: number;
  filesReferenced: string[];
  fileContextUsed: boolean;
  intelligencePlan?: import("./intelligence-core/types").IntelligenceCorePlan;
  contextCompressionRatio?: number;
  documentCitations?: string[];
}

export interface ChatExecutionTestHooks {
  injectedMemory?: () => Promise<{ formatted: string }>;
  contextAssessment?: () => Promise<any>;
  knowledgeContext?: () => Promise<any>;
  adminContext?: () => Promise<any>;
  fileContext?: () => Promise<{ prompt: string; filesReferenced: string[]; failedFiles: string[]; imageBlocks?: ImageBlock[] }>;
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

export class ChatExecutionService {
  static async execute(input: ChatExecutionInput, hooks: ChatExecutionTestHooks = {}): Promise<Record<string, any>> {
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
      providerUsed: getActiveProviderName({ lane: "chat" }),
      providerTarget: getResolvedTargetName({ lane: "chat" }),
    };

    try {
      if (!input.message?.trim()) {
        trace.executionStatus = "failed";
        trace.failureReason = "message_required";
        return { error: "message_required", reply: "Message required.", agent: "ManagerAgent", metadata: { executionTrace: trace }, trace };
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
      const webLookupIntent = isWebLookupIntent(effectiveMessage) || isWebLookupIntent(input.message);
      trace.detectedIntent = webLookupIntent ? "web_research" : "manager";
      let contextInquiryPrompt = "";
      let contextMaterialUncertainty = false;

      // If Context Inquiry finds a genuinely high-priority missing fact
      // AND the previous assistant turn wasn't itself a clarifying
      // question, we short-circuit the whole cognitive core and return
      // the question as ZED's reply. That's what makes Zed feel like
      // it's actually reasoning: on a clear "I need to know X before I
      // can answer well" it pauses instead of blindly answering.
      let pauseAndAsk: {
        reply: string;
        question: any;
        assessment: any;
      } | null = null;

      if (!webLookupIntent) {
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

            if (priorityHighEnough && !priorWasClarifying) {
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
        const { reply, question, assessment } = pauseAndAsk;
        trace.executionStatus = "success";
        trace.detectedIntent = "clarify";
        trace.selectedAgent = "ContextInquiryEngine";
        trace.fallbackReason = "context_inquiry_paused_and_asked";

        const metadata = {
          agent: "ContextInquiryEngine",
          actionType: "clarifying_question",
          clarifyingQuestion: true,
          questionPriority: Number(question.priority),
          questionCategory: question.category,
          contextAssessment: compactContextAssessment(assessment, question),
          executionTrace: trace,
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
          agent: "ContextInquiryEngine",
          metadata,
          trace,
        };
      }

      const injectedMemory = hooks.injectedMemory
        ? await hooks.injectedMemory()
        : await injectMemory("ManagerAgent", {
            includeFoundation: Boolean(input.isAdmin),
          }).catch(() => ({ formatted: "" }));
      if (injectedMemory.formatted) trace.memorySources.push("MemoryInjector");

      trace.servicesInvoked.push("KnowledgeService.buildContext");
      const knowledge = hooks.knowledgeContext
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

      trace.servicesInvoked.push("buildZedAdminContext");
      const adminContext = hooks.adminContext
        ? await hooks.adminContext()
        : await buildZedAdminContext({
            userId: input.userId,
            conversationId: input.conversationId,
            projectId: input.projectId || input.context?.projectId,
            workspaceId: input.workspaceId || input.context?.workspaceId,
          } as any);
      trace.projectContextUsed = Boolean(adminContext.meta.projectInstructions || adminContext.meta.projectSourceCount);
      trace.projectSources = adminContext.meta.projectSourceCount ? ["ProjectFilingStore"] : [];
      trace.sourceCount = adminContext.meta.projectSourceCount || 0;

      const fileContext = hooks.fileContext
        ? await hooks.fileContext()
        : await buildFileContext(input.conversationId);
      trace.filesReferenced = fileContext.filesReferenced;
      trace.fileContextUsed = Boolean(fileContext.prompt);
      if (fileContext.prompt) trace.memorySources.push("conversation_files");
      if (fileContext.failedFiles.length > 0) {
        trace.executionStatus = trace.executionStatus === "success" ? "partial" : trace.executionStatus;
        trace.failureReason = `file_processing_failed:${fileContext.failedFiles.join(",")}`;
      }

      const strategicReasoning = ZedStrategicReasoningEngine.prepare({
        userMessage: effectiveMessage,
        lane: "manager",
        knowledgePresent: Boolean(knowledge.prompt || adminContext.text || fileContext.prompt),
        currentContext: input.context || {},
      });
      const cognitiveLane = strategicReasoning.active ? "strategy" : "manager";
      const voiceMode = strategicReasoning.active ? "strategy" : "chat";
      const governancePrompt = buildZedGovernancePrompt({
        userMessage: effectiveMessage,
        lane: cognitiveLane,
        knowledgePresent: Boolean(knowledge.prompt || adminContext.text || fileContext.prompt),
      });
      const principlePrompt = ZedPrincipleEngine.buildPrompt({
        userMessage: effectiveMessage,
        lane: cognitiveLane,
        isAdmin: Boolean(input.isAdmin),
        knowledgePresent: Boolean(knowledge.prompt || adminContext.text || fileContext.prompt),
      });
      const voicePrompt = hooks.voicePrompt
        ? await hooks.voicePrompt()
        : await buildZedVoicePrompt({ mode: voiceMode });

      // Document Intelligence — surface knowledge extracted from uploaded
      // and previously-ingested documents (connected in the knowledge
      // graph) with source attribution. Best-effort; never blocks a reply.
      trace.servicesInvoked.push("DocumentIntelligenceService.retrieveForQuery");
      const documentKnowledge = await DocumentIntelligenceService.retrieveForQuery(
        effectiveMessage,
      ).catch(() => ({ block: "", objectIds: [], citations: [], conflictCount: 0 }));
      if (documentKnowledge.objectIds.length > 0) {
        trace.memorySources.push("DocumentKnowledgeGraph");
        trace.documentCitations = documentKnowledge.citations;
      }

      // Intelligence Core — Deep Thinking (staged reasoning), Self-
      // Orchestration (capability plan), and Adaptive Response
      // (response-form directive). Deterministic, synchronous, no I/O.
      trace.servicesInvoked.push("IntelligenceCore.analyze");
      const intelligence = IntelligenceCore.analyze({
        message: effectiveMessage,
        lane: cognitiveLane,
        strategic: strategicReasoning.active,
        knowledgePresent: Boolean(
          knowledge.prompt || adminContext.text || fileContext.prompt || documentKnowledge.block,
        ),
        materialUncertainty: contextMaterialUncertainty,
        hasFiles: Boolean(fileContext.prompt),
        hasGraphContext: documentKnowledge.objectIds.length > 0,
        hasMemory: Boolean(knowledge.prompt || injectedMemory.formatted),
      });
      trace.intelligencePlan = intelligence.plan;

      // Context Intelligence — rank, de-duplicate, compress, and merge the
      // heavy retrieved blocks into one budgeted knowledge prompt instead
      // of concatenating overlapping sources. Project instructions and
      // uploaded files are pinned so they always survive.
      trace.servicesInvoked.push("ContextIntelligenceEngine.rank");
      const rankedContext = ContextIntelligenceEngine.rank(effectiveMessage, [
        { label: "project", text: adminContext.text, pinned: true, basePriority: 0.9 },
        { label: "files", text: fileContext.prompt, pinned: true, basePriority: 0.9 },
        { label: "documents", text: documentKnowledge.block, basePriority: 0.75 },
        { label: "knowledge", text: knowledge.prompt, basePriority: 0.5 },
      ]);
      trace.contextCompressionRatio = rankedContext.compressionRatio;
      // Safety net: never let ranking silently drop all context.
      const knowledgeBlock =
        rankedContext.prompt.trim().length > 0
          ? rankedContext.prompt
          : [adminContext.text, fileContext.prompt, documentKnowledge.block, knowledge.prompt]
              .filter(Boolean)
              .join("\n\n");

      // Cognitive Core order per SPEC.md § Cognitive Core:
      //   1. Context Inquiry   2. Principle   3. Strategic
      //   4. Knowledge         5. Voice        6. Reflection (post-response)
      // Intelligence Core reasoning stages (deep thinking + self-
      // orchestration) sit with Strategic Reasoning before knowledge; the
      // adaptive response directive sits just before Voice. Governance is
      // pinned first; response policy is pinned last so style wins ties.
      const cognitiveKnowledgePrompt = [
        governancePrompt,
        contextInquiryPrompt,
        principlePrompt,
        strategicReasoning.prompt,
        intelligence.reasoningPrompt,
        knowledgeBlock,
        intelligence.responsePrompt,
        voicePrompt,
        getZedResponsePolicy(voiceMode),
      ]
        .filter(Boolean)
        .join("\n\n");

      trace.servicesInvoked.push("ZedAutonomousOrchestrator.route", "ManagerAgent.route");
      const routeRequest = {
        userId: input.userId,
        message: effectiveMessage,
        conversationId: input.conversationId,
        ip: input.ip || "",
        targetAgent: input.targetAgent,
        context: {
          ...(input.context || {}),
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          knowledgePrompt: cognitiveKnowledgePrompt,
          isAdmin: Boolean(input.isAdmin),
          strategic: strategicReasoning.active,
          attachments: fileContext.imageBlocks,
        },
      };
      const response = hooks.route
        ? await hooks.route(routeRequest)
        : await ZedAutonomousOrchestrator.route(routeRequest);

      const upstreamEmpty = emptyOutput(response.reply);
      const upstreamTemplate = !upstreamEmpty && hasTemplateLeakage(response.reply);
      if (upstreamEmpty || upstreamTemplate) {
        trace.executionStatus = "failed";
        trace.failureReason = upstreamEmpty ? "upstream_empty_output" : "upstream_template_output";
      }

      const presented = await (hooks.present || presentZedResponseWithChecks)(
        trace.executionStatus === "failed"
          ? `Execution failed: ${trace.failureReason}.`
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

      const managerMetadata = response.metadata || {};
      trace.detectedIntent = managerMetadata.intent || trace.detectedIntent;
      trace.selectedAgent = response.agent || managerMetadata.selectedAgent;
      trace.classifierResult = managerMetadata.classifierResult;
      trace.classifierFailed = managerMetadata.classifierFailed;
      trace.fallbackReason = managerMetadata.fallbackReason || trace.fallbackReason;
      trace.servicesInvoked = Array.from(new Set([...trace.servicesInvoked, ...(managerMetadata.servicesInvoked || [])]));
      trace.toolsInvoked = Array.from(new Set([...trace.toolsInvoked, ...(managerMetadata.toolsInvoked || [])]));
      trace.externalCalls = Array.from(new Set([...trace.externalCalls, ...(managerMetadata.web?.pages?.length ? ["direct_url_fetch"] : [])]));

      const metadata = {
        ...managerMetadata,
        strategic: strategicReasoning.active,
        intelligencePlan: trace.intelligencePlan,
        contextCompressionRatio: trace.contextCompressionRatio,
        documentCitations: trace.documentCitations,
        providerUsed: trace.providerUsed,
        providerTarget: trace.providerTarget,
        projectContextUsed: trace.projectContextUsed,
        workspaceContextUsed: trace.workspaceContextUsed,
        sourceCount: trace.sourceCount,
        filesReferenced: trace.filesReferenced,
        fileContextUsed: trace.fileContextUsed,
        presentationAdjustments: trace.presentationAdjustments,
        executionStatus: trace.executionStatus,
        failureReason: trace.failureReason,
        mocked: trace.mocked,
        executionTrace: trace,
      };

      await saveAssistantMessage(input.conversationId, presented.content, {
        agent: response.agent,
        requiresApproval: response.requiresApproval,
        ...metadata,
      });

      await (hooks.reflect || ZedReflectionEngine.reflectAfterReply)({
        userId: input.userId,
        conversationId: input.conversationId,
        userMessage: input.message,
        assistantReply: presented.content,
        route: "orchestrate",
        strategic: strategicReasoning.active,
        requiresApproval: response.requiresApproval,
        tags: ["orchestrate", "cognitive-core", trace.selectedAgent || "unknown-agent"],
      }).catch((error) => {
        void (hooks.log || logRuntimeEvent)({
          level: "warn",
          source: "server",
          event: "reflection.failed",
          detail: error?.message || String(error),
          context: { traceId: trace.traceId, conversationId: input.conversationId },
        });
      });

      auditTrace(trace as any);
      await (hooks.log || logRuntimeEvent)({
        level: trace.executionStatus === "failed" ? "error" : "info",
        source: "server",
        event: "chat.execution.trace",
        detail: `${trace.route} -> ${trace.selectedAgent || "unknown"} -> ${trace.executionStatus}`,
        context: trace as any,
      });

      return {
        ...response,
        reply: presented.content,
        metadata,
        trace,
      };
    } catch (error: any) {
      trace.executionStatus = "failed";
      trace.failureReason = normalizeFailureReason(error, trace);
      await (hooks.log || logRuntimeEvent)({
        level: "error",
        source: "server",
        event: "chat.execution.failed",
        detail: trace.failureReason,
        context: { traceId: trace.traceId, conversationId: input.conversationId },
      });
      const failureReply = `Execution failed: ${trace.failureReason}.`;
      await saveAssistantMessage(input.conversationId, failureReply, {
        agent: "ManagerAgent",
        executionStatus: trace.executionStatus,
        failureReason: trace.failureReason,
        executionTrace: trace,
      }).catch(() => null);
      return {
        error: "execution_failed",
        reply: failureReply,
        agent: "ManagerAgent",
        metadata: {
          executionStatus: trace.executionStatus,
          failureReason: trace.failureReason,
          executionTrace: trace,
        },
        trace,
      };
    }
  }
}

export default ChatExecutionService;
