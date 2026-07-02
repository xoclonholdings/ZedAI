import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { storage } from "../storage/databaseStorage";
import { insertMessageSchema } from "../../shared/schema";
import { checkTiers } from "../middleware/TierEnforcement";
import { ManagerAgent } from "../orchestrator/ManagerAgent";
import { KnowledgeService } from "../services/KnowledgeService";
import { ContextInquiryEngine } from "../services/knowledge-ingestion/ContextInquiryEngine";
import { ZedPrincipleEngine } from "../services/ZedPrincipleEngine";
import { ZedStrategicReasoningEngine } from "../services/ZedStrategicReasoningEngine";
import { ZedReflectionEngine } from "../services/ZedReflectionEngine";
import { injectMemory } from "../services/MemoryInjector";
import {
  generateChatFromOllama,
  streamChatFromOllama,
  type OllamaMessage,
} from "../services/Ollama/OllamaService";
import { buildZedAdminContext } from "../services/ZedContextBuilder";
import { getZedResponsePolicy, type ZedResponseMode } from "../services/ZedResponsePolicy";
import {
  buildZedGovernancePrompt,
  userRequestedSourceLinks,
} from "../services/ZedResponseGovernance";
import {
  buildZedVoicePrompt,
  ingestZedVoiceCorrection,
  presentZedResponse,
} from "../services/ZedVoiceFormationEngine";
import { extractWebTargets, hasWebsiteReferenceWithoutTarget } from "../services/WebContentService";
import { logRuntimeEvent } from "../services/RuntimeLogger";
import { requireConversation } from "./conversations-crud";

const ZED_IDENTITY_PROMPT = [
  "You are ZED, the conversational interface for the Zebulon Commander ecosystem.",
  "Answer from available memory and source context when it is relevant.",
  "Do not use report labels, canned structure, placeholder output, or empty-response substitutes.",
  "If a route, model, or tool fails, identify the concrete failed condition.",
  "Use short mobile-readable markdown unless the user asks for depth.",
].join(" ");

type ContextInquiryQuestion = {
  question: string;
  priority: number;
  category?: string;
  wouldChange?: string[];
};

type ContextAssessmentForSummary = {
  responsePolicy: string;
  materialUncertainty: boolean;
  questions: ContextInquiryQuestion[];
};

function topQuestion(questions: ContextInquiryQuestion[]): ContextInquiryQuestion | null {
  return [...(questions || [])].sort((a, b) => b.priority - a.priority)[0] || null;
}

function questionOnly(question: string): string {
  const cleaned = question.trim().replace(/\s+/g, " ");
  return /[?.!]$/.test(cleaned) ? cleaned : `${cleaned}?`;
}

function compactAssessment(assessment: ContextAssessmentForSummary, question: ContextInquiryQuestion) {
  return {
    responsePolicy: assessment.responsePolicy,
    materialUncertainty: assessment.materialUncertainty,
    questionCount: assessment.questions.length,
    questionCategory: question.category,
    affects: Array.isArray(question.wouldChange) ? question.wouldChange : [],
  };
}

function resolveReferencedWebpage(content: string, history: any[]): string {
  if (extractWebTargets(content).length > 0) return content;
  if (!hasWebsiteReferenceWithoutTarget(content)) return content;

  for (const message of [...history].reverse()) {
    const target = extractWebTargets(String(message?.content || ""))[0];
    if (target?.url) return `${content}\n\nReferenced webpage from recent conversation: ${target.url}`;
  }

  return content;
}

function isWebLookupIntent(message: string): boolean {
  const text = String(message || "").toLowerCase();
  if (!text) return false;
  if (/\bhttps?:\/\/\S+/i.test(message)) return true;
  if (/\bwww\.\S+/i.test(message)) return true;
  if (/\b[a-z0-9-]+\.[a-z]{2,24}(?:\/\S*)?\b/i.test(message)) {
    const fileExt = /\.(txt|md|pdf|png|jpe?g|gif|webp|json|ya?ml|csv|xlsx?|docx?|mp[34]|wav|zip|tar|gz)\b/i;
    if (!fileExt.test(message)) return true;
  }

  return [
    "visit", "browse", "inspect", "website", "webpage", "url", "link",
    "check this site", "check the site", "look up", "search the web",
    "latest", "current", "news", "review this website", "summarize this page",
    "read this page", "open the url",
  ].some((phrase) => text.includes(phrase));
}

function emptyOutput(value: unknown): boolean {
  return !String(value || "").replace(/\(no response\)/gi, "").trim();
}

function failure(scope: string, detail: unknown): string {
  const cleaned = String(detail instanceof Error ? detail.message : detail || "unknown").replace(/\s+/g, " ").trim();
  return `${scope} failed: ${cleaned}`;
}

async function presentStrict(draft: string, options: Parameters<typeof presentZedResponse>[1], scope: string): Promise<string> {
  const initial = emptyOutput(draft) ? failure(scope, "no generated text returned") : draft;
  const presented = await presentZedResponse(initial, options);
  return emptyOutput(presented) ? failure("presentation", "all generated text was removed by response checks") : presented;
}

async function saveAssistant(conversationId: string, content: string, metadata?: Record<string, unknown>) {
  if (emptyOutput(content)) throw new Error("assistant_output_empty");
  return storage.createMessage(insertMessageSchema.parse({ conversationId, role: "assistant", content, metadata }));
}

async function persistAndReflect(params: {
  userId: string;
  conversationId: string;
  userContent: string;
  assistantContent: string;
  tags: string[];
  route: string;
  strategic?: boolean;
  requiresApproval?: boolean;
}) {
  await KnowledgeService.persistInteraction({
    userId: params.userId,
    conversationId: params.conversationId,
    userContent: params.userContent,
    assistantContent: params.assistantContent,
    tags: params.tags,
  });

  await ZedReflectionEngine.reflectAfterReply({
    userId: params.userId,
    conversationId: params.conversationId,
    userMessage: params.userContent,
    assistantReply: params.assistantContent,
    route: params.route,
    strategic: params.strategic,
    requiresApproval: params.requiresApproval,
    tags: [...params.tags, "cognitive-core"],
  }).catch((err) => {
    void logRuntimeEvent({
      level: "warn",
      source: "server",
      event: "reflection.failed",
      detail: err?.message || String(err),
      context: { conversationId: params.conversationId },
    });
  });
}

function writeSseHeaders(res: any) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
}

async function sendDone(res: any, stream: boolean, payload: any) {
  if (stream) {
    writeSseHeaders(res);
    if (payload.userMessage) res.write(`data: ${JSON.stringify({ type: "user_message", message: payload.userMessage })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done", message: payload.aiMessage })}\n\n`);
    res.end();
  } else {
    res.json(payload.userMessage ? payload : { aiMessage: payload.aiMessage });
  }
}

export function registerConversationSendRoutes(app: Express): void {
  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = req.params.id;
      const { content, stream = true } = req.body;
      const conversation = await requireConversation(req, res);
      if (!conversation) return;
      if (!content) return res.status(400).json({ error: "Message required" });

      const userId = req.user?.claims?.sub || "unknown";
      const isAdmin = !!req.user?.claims?.isAdmin;
      const includeSources = userRequestedSourceLinks(content);
      let cognitiveVoiceMode: ZedResponseMode = "chat";
      let cognitiveStrategicActive = false;

      const tierCheck = await checkTiers(content, userId, req.ip || "");
      if (tierCheck.blocked) {
        const blockedContent = await presentStrict(tierCheck.reply, { userMessage: content, includeSources, mode: "chat", grounded: true }, "tier enforcement");
        const blockedMsg = await saveAssistant(conversationId, blockedContent);
        await sendDone(res, stream, { aiMessage: blockedMsg });
        return;
      }

      const userMessage = await storage.createMessage(insertMessageSchema.parse({ conversationId, role: "user", content }));
      const messagesBeforeReply = await storage.getMessagesByConversation(conversationId);
      const previousAssistant = [...messagesBeforeReply].reverse().find((message: any) => message.role === "assistant");
      const webLookupMessage = resolveReferencedWebpage(content, messagesBeforeReply);

      await ingestZedVoiceCorrection({ userId, conversationId, userMessage: content, previousAssistantContent: previousAssistant?.content }).catch((err) => {
        void logRuntimeEvent({ level: "warn", source: "server", event: "voice.correction_ingest.failed", detail: err?.message || String(err), context: { conversationId } });
      });

      if (!isWebLookupIntent(content)) {
        try {
          const contextAssessmentResult = await ContextInquiryEngine.assess({ userInput: content });
          const assessment = contextAssessmentResult.assessment;
          const question = topQuestion(assessment.questions);
          if (assessment.responsePolicy === "inquire_first" && question) {
            const assistantContent = await presentStrict(questionOnly(question.question), { userMessage: content, includeSources: false, mode: "chat", grounded: true }, "context inquiry");
            const aiMessage = await saveAssistant(conversationId, assistantContent, { contextInquiry: true, contextAssessment: compactAssessment(assessment, question) });
            await sendDone(res, stream, { userMessage, aiMessage });
            return;
          }
        } catch (contextErr) {
          void logRuntimeEvent({ level: "warn", source: "server", event: "context_inquiry.failed", detail: contextErr instanceof Error ? contextErr.message : String(contextErr), context: { conversationId } });
        }
      }

      if (isWebLookupIntent(content)) {
        try {
          const result = await ManagerAgent.route({ userId, message: webLookupMessage, conversationId, ip: req.ip || "", targetAgent: "research", context: { isAdmin } });
          const presentedReply = await presentStrict(result.reply, { userMessage: content, includeSources, mode: "research", grounded: true }, "web research");
          const aiMessage = await saveAssistant(conversationId, presentedReply);
          await persistAndReflect({ userId, conversationId, userContent: content, assistantContent: aiMessage.content, tags: ["chat", "web", "research"], route: "chat", strategic: Boolean(result.metadata?.strategic), requiresApproval: result.requiresApproval });
          await sendDone(res, stream, { userMessage, aiMessage });
          return;
        } catch (webErr: any) {
          const detail = webErr?.message || String(webErr);
          void logRuntimeEvent({ level: "error", source: "server", event: "chat.web_lookup.failed", detail, context: { conversationId, errorKind: webErr?.constructor?.name } });
          const aiMessage = await saveAssistant(conversationId, failure("web research", detail), { failure: { scope: "web", detail, targetResolved: webLookupMessage !== content } });
          await sendDone(res, stream, { userMessage, aiMessage });
          return;
        }
      }

      const ollamaMessages: OllamaMessage[] = messagesBeforeReply.slice(-20).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }));
      let systemPrompt: string | undefined;
      try {
        const mem = await storage.getCoreMemoryByKey("system_prompt");
        if (mem) systemPrompt = mem.value;
      } catch {}

      try {
        const memCtx = await injectMemory("ChatMode", { includeFoundation: isAdmin });
        const knowledge = await KnowledgeService.buildContext({ userId, query: content, conversationId, lane: "chat", injectedMemory: memCtx.formatted, includeAdminFoundation: isAdmin });
        const adminCtx = await buildZedAdminContext({ userId, conversationId });
        const strategicReasoning = ZedStrategicReasoningEngine.prepare({ userMessage: content, lane: "chat", knowledgePresent: Boolean(knowledge.prompt || adminCtx.text || systemPrompt), currentContext: { conversationId, isAdmin } });
        cognitiveStrategicActive = strategicReasoning.active;
        cognitiveVoiceMode = strategicReasoning.active ? "strategy" : "chat";
        systemPrompt = [ZED_IDENTITY_PROMPT, buildZedGovernancePrompt({ userMessage: content, lane: cognitiveVoiceMode, knowledgePresent: Boolean(knowledge.prompt || adminCtx.text || systemPrompt) }), ZedPrincipleEngine.buildPrompt({ userMessage: content, lane: cognitiveVoiceMode, knowledgePresent: Boolean(knowledge.prompt || adminCtx.text || systemPrompt), isAdmin }), strategicReasoning.prompt, await buildZedVoicePrompt({ mode: cognitiveVoiceMode }), getZedResponsePolicy(cognitiveVoiceMode), systemPrompt || "", adminCtx.text, knowledge.prompt].filter(Boolean).join("\n\n");
      } catch (memErr) {
        console.warn("[SSE] Memory injection failed:", memErr);
      }

      if (!systemPrompt) {
        const strategicReasoning = ZedStrategicReasoningEngine.prepare({ userMessage: content, lane: "chat", knowledgePresent: false, currentContext: { conversationId, isAdmin } });
        cognitiveStrategicActive = strategicReasoning.active;
        cognitiveVoiceMode = strategicReasoning.active ? "strategy" : "chat";
        systemPrompt = [ZED_IDENTITY_PROMPT, buildZedGovernancePrompt({ userMessage: content, lane: cognitiveVoiceMode }), ZedPrincipleEngine.buildPrompt({ userMessage: content, lane: cognitiveVoiceMode, knowledgePresent: false, isAdmin }), strategicReasoning.prompt, await buildZedVoicePrompt({ mode: cognitiveVoiceMode }), getZedResponsePolicy(cognitiveVoiceMode)].join("\n\n");
      }

      if (stream) {
        writeSseHeaders(res);
        let fullResponse = "";
        res.write(`data: ${JSON.stringify({ type: "user_message", message: userMessage })}\n\n`);
        await streamChatFromOllama(
          ollamaMessages,
          systemPrompt,
          (token) => { fullResponse += token; },
          async () => {
            const presentedResponse = await presentStrict(fullResponse, { userMessage: content, includeSources, mode: cognitiveVoiceMode, grounded: true }, "model stream");
            const aiMessage = await saveAssistant(conversationId, presentedResponse, emptyOutput(fullResponse) ? { failure: { scope: "model", detail: "stream_closed_without_text" } } : undefined);
            await persistAndReflect({ userId, conversationId, userContent: content, assistantContent: aiMessage.content, tags: ["chat", "conversation"], route: "chat", strategic: cognitiveStrategicActive });
            res.write(`data: ${JSON.stringify({ type: "token", token: presentedResponse })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: "done", message: aiMessage })}\n\n`);
            res.end();
          },
          async (err) => {
            const detail = err?.message || String(err);
            const errorText = failure("model stream", detail);
            const aiMessage = await saveAssistant(conversationId, errorText, { failure: { scope: "model", detail } });
            res.write(`data: ${JSON.stringify({ type: "error", message: aiMessage, error: errorText })}\n\n`);
            res.end();
          },
          { lane: "chat" },
        );
      } else {
        let aiText: string;
        try {
          aiText = await generateChatFromOllama(ollamaMessages, systemPrompt, { lane: "chat" });
        } catch (err: any) {
          aiText = failure("model call", err?.message || String(err));
        }
        const presentedText = await presentStrict(aiText, { userMessage: content, includeSources, mode: cognitiveVoiceMode, grounded: true }, "model call");
        const aiMessage = await saveAssistant(conversationId, presentedText, emptyOutput(aiText) ? { failure: { scope: "model", detail: "empty_model_text" } } : undefined);
        await persistAndReflect({ userId, conversationId, userContent: content, assistantContent: aiMessage.content, tags: ["chat", "conversation"], route: "chat", strategic: cognitiveStrategicActive });
        res.json({ userMessage, aiMessage });
      }
    } catch (error) {
      console.error("[Messages] Error:", error);
      if (!res.headersSent) res.status(500).json({ error: "message_processing_failed", detail: error instanceof Error ? error.message : String(error) });
    }
  });
}
