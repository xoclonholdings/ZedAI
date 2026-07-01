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
import { logRuntimeEvent } from "../services/RuntimeLogger";
import { requireConversation } from "./conversations-crud";

/**
 * POST /api/conversations/:id/messages - the big SSE handler.
 *
 * Lives in its own module because it pulls in the entire chat stack
 * (tier enforcement, ManagerAgent for web-lookup routing, memory
 * injection, knowledge context, admin ruleset context, Ollama streaming)
 * and the inline version was ~220 lines on its own.
 */

const ZED_IDENTITY_PROMPT = [
  "You are ZED, the conversational interface for the Zebulon Commander ecosystem.",
  "Never describe yourself as 'an agent named Agent' or 'ZED Hub's agent'.",
  "If asked your name, answer simply: 'I am ZED.'",
  "Use provided memory context as background knowledge when it is relevant.",
  "If the knowledge context already identifies the company, project, brand, or user goals, answer from that context instead of asking broad generic follow-up questions.",
  "When the answer is grounded in known foundation, rules, or project memory, be direct and specific.",
  "Match your response length to the question. Greetings get one short sentence. Simple setup questions get the answer and the next concrete step. Long explanations are only for complex or explicitly detailed requests.",
  "Do not restate the question, do not write preamble like 'Great question!' or 'Here is the answer:', and do not summarize what you're about to say before saying it.",
  "Use mobile-readable GitHub-flavored markdown. Prefer short paragraphs and compact bullets. Use natural headings only when helpful.",
  "Do not use default report labels such as Research Brief, Confidence, Key Findings, Findings, Implications, Recommended Action, Executive Summary, Analysis Results, Final Assessment, Full Response, or See full response for details.",
  "Do not use large markdown tables unless the user explicitly asks for a table or the data cannot be understood clearly without one. Prefer bullets, grouped lines, or short code blocks on mobile.",
  "When showing multiple environment variables, commands, config values, or KEY=value lines, use a fenced code block so they stay readable.",
  "Recognize lightweight response modes when requested: Chat, Research, Build, Strategy, and Memory. Do not build a mode switch UI inside the response.",
  "Never emit literal <br> or <br/> tags. Use blank lines or list items instead.",
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

function selectTopContextQuestion(questions: ContextInquiryQuestion[]): ContextInquiryQuestion | null {
  return [...(questions || [])].sort((a, b) => b.priority - a.priority)[0] || null;
}

function formatContextInquiryReply(question: string): string {
  const cleanedQuestion = question.trim().replace(/\s+/g, " ");
  const punctuatedQuestion = /[?.!]$/.test(cleanedQuestion) ? cleanedQuestion : `${cleanedQuestion}?`;
  return `I need one detail before I can answer that cleanly: ${punctuatedQuestion}`;
}

function compactContextAssessment(
  assessment: ContextAssessmentForSummary,
  topQuestion: ContextInquiryQuestion,
): Record<string, unknown> {
  return {
    responsePolicy: assessment.responsePolicy,
    materialUncertainty: assessment.materialUncertainty,
    questionCount: assessment.questions.length,
    questionCategory: topQuestion.category,
    affects: Array.isArray(topQuestion.wouldChange) ? topQuestion.wouldChange : [],
  };
}

/**
 * Detects when a chat-mode message is actually a web lookup / research
 * intent and should be routed through ManagerAgent -> IntelligenceAgent
 * (which has WebSearchService wired) instead of plain chat streaming.
 * Otherwise ZED replies "I cannot browse" because the chat lane has
 * no tool access.
 */
function isWebLookupIntent(message: string): boolean {
  if (!message) return false;
  const text = message.toLowerCase();

  if (/\bhttps?:\/\/\S+/i.test(message)) return true;
  if (/\bwww\.\S+/i.test(message)) return true;
  if (/\b[a-z0-9-]+\.[a-z]{2,24}(?:\/\S*)?\b/i.test(message)) {
    const fileExt = /\.(txt|md|pdf|png|jpe?g|gif|webp|json|ya?ml|csv|xlsx?|docx?|mp[34]|wav|zip|tar|gz)\b/i;
    if (!fileExt.test(message)) return true;
  }

  const phrases = [
    "visit", "browse", "inspect", "check this site", "check the site",
    "look up", "lookup", "search the web", "web search", "google this",
    "latest", "current", "today's", "news on", "news about", "what's new",
    "analyze this website", "audit this website", "review this website",
    "summarize this page", "summarize this site", "summarize the page",
    "scrape", "crawl", "fetch the page", "read this page", "open the url",
    "look at the link",
  ];
  for (const p of phrases) {
    if (text.includes(p)) return true;
  }
  return false;
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

      const tierCheck = await checkTiers(
        content,
        userId,
        req.ip || "",
      );
      if (tierCheck.blocked) {
        const blockedContent = await presentZedResponse(tierCheck.reply, {
          userMessage: content,
          includeSources,
          mode: "chat",
          grounded: true,
        });
        const blockedMsg = await storage.createMessage(
          insertMessageSchema.parse({
            conversationId,
            role: "assistant",
            content: blockedContent,
          }),
        );
        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.write(`data: ${JSON.stringify({ type: "done", message: blockedMsg })}\n\n`);
          res.end();
        } else {
          res.json({ aiMessage: blockedMsg });
        }
        return;
      }

      const userMessage = await storage.createMessage(
        insertMessageSchema.parse({ conversationId, role: "user", content }),
      );

      const messagesBeforeReply = await storage.getMessagesByConversation(conversationId);
      const previousAssistant = [...messagesBeforeReply]
        .reverse()
        .find((message: any) => message.role === "assistant");
      await ingestZedVoiceCorrection({
        userId,
        conversationId,
        userMessage: content,
        previousAssistantContent: previousAssistant?.content,
      }).catch((err) => {
        void logRuntimeEvent({
          level: "warn",
          source: "server",
          event: "voice.correction_ingest.failed",
          detail: err?.message || String(err),
          context: { conversationId },
        });
      });

      try {
        const contextAssessmentResult = await ContextInquiryEngine.assess({ userInput: content });
        const assessment = contextAssessmentResult.assessment;
        const topQuestion = selectTopContextQuestion(assessment.questions);

        if (assessment.responsePolicy === "inquire_first" && topQuestion) {
          const assistantContent = await presentZedResponse(formatContextInquiryReply(topQuestion.question), {
            userMessage: content,
            includeSources: false,
            mode: "chat",
            grounded: true,
          });
          const aiMessage = await storage.createMessage(
            insertMessageSchema.parse({
              conversationId,
              role: "assistant",
              content: assistantContent,
              metadata: {
                contextInquiry: true,
                contextAssessment: compactContextAssessment(assessment, topQuestion),
              },
            }),
          );

          if (stream) {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("X-Accel-Buffering", "no");
            res.write(`data: ${JSON.stringify({ type: "user_message", message: userMessage })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: "done", message: aiMessage })}\n\n`);
            res.end();
          } else {
            res.json({ userMessage, aiMessage });
          }
          return;
        }
      } catch (contextErr) {
        void logRuntimeEvent({
          level: "warn",
          source: "server",
          event: "context_inquiry.failed",
          detail: contextErr instanceof Error ? contextErr.message : String(contextErr),
          context: { conversationId },
        });
      }

      if (isWebLookupIntent(content)) {
        try {
          const result = await ManagerAgent.route({
            userId,
            message: content,
            conversationId,
            ip: req.ip || "",
            targetAgent: "research",
            context: { isAdmin },
          });
          const presentedReply = await presentZedResponse(result.reply || "(no response)", {
            userMessage: content,
            includeSources,
            mode: "research",
            grounded: true,
          });
          const aiMessage = await storage.createMessage(
            insertMessageSchema.parse({
              conversationId,
              role: "assistant",
              content: presentedReply,
            }),
          );
          await KnowledgeService.persistInteraction({
            userId,
            conversationId,
            userContent: content,
            assistantContent: aiMessage.content,
            tags: ["chat", "web", "research"],
          });
          await ZedReflectionEngine.reflectAfterReply({
            userId,
            conversationId,
            userMessage: content,
            assistantReply: aiMessage.content,
            route: "chat",
            strategic: Boolean(result.metadata?.strategic),
            requiresApproval: result.requiresApproval,
            tags: ["chat", "research", "cognitive-core"],
          }).catch((err) => {
            void logRuntimeEvent({
              level: "warn",
              source: "server",
              event: "reflection.failed",
              detail: err?.message || String(err),
              context: { conversationId },
            });
          });
          if (stream) {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("X-Accel-Buffering", "no");
            res.write(
              `data: ${JSON.stringify({ type: "user_message", message: userMessage })}\n\n`,
            );
            res.write(`data: ${JSON.stringify({ type: "done", message: aiMessage })}\n\n`);
            res.end();
          } else {
            res.json({ userMessage, aiMessage });
          }
          return;
        } catch (webErr: any) {
          // Fall through to the normal chat path so the user still gets
          // some reply rather than a 500. The runtime log captures it.
          void logRuntimeEvent({
            level: "error",
            source: "server",
            event: "chat.web_lookup.failed",
            detail: webErr?.message || String(webErr),
            context: {
              conversationId,
              errorKind: webErr?.constructor?.name,
            },
          });
        }
      }

      const history = messagesBeforeReply;
      const ollamaMessages: OllamaMessage[] = history
        .slice(-20)
        .map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }));

      let systemPrompt: string | undefined;
      try {
        const mem = await storage.getCoreMemoryByKey("system_prompt");
        if (mem) systemPrompt = mem.value;
      } catch {
        /* core memory lookup is best-effort */
      }

      try {
        const memCtx = await injectMemory("ChatMode", { includeFoundation: isAdmin });
        const knowledge = await KnowledgeService.buildContext({
          userId,
          query: content,
          conversationId,
          lane: "chat",
          injectedMemory: memCtx.formatted,
          includeAdminFoundation: isAdmin,
        });
        const adminCtx = await buildZedAdminContext({
          userId,
          conversationId,
        });
        const strategicReasoning = ZedStrategicReasoningEngine.prepare({
          userMessage: content,
          lane: "chat",
          knowledgePresent: Boolean(knowledge.prompt || adminCtx.text || systemPrompt),
          currentContext: { conversationId, isAdmin },
        });
        cognitiveStrategicActive = strategicReasoning.active;
        cognitiveVoiceMode = strategicReasoning.active ? "strategy" : "chat";
        systemPrompt = [
          ZED_IDENTITY_PROMPT,
          buildZedGovernancePrompt({
            userMessage: content,
            lane: cognitiveVoiceMode,
            knowledgePresent: Boolean(knowledge.prompt || adminCtx.text || systemPrompt),
          }),
          ZedPrincipleEngine.buildPrompt({
            userMessage: content,
            lane: cognitiveVoiceMode,
            knowledgePresent: Boolean(knowledge.prompt || adminCtx.text || systemPrompt),
            isAdmin,
          }),
          strategicReasoning.prompt,
          await buildZedVoicePrompt({ mode: cognitiveVoiceMode }),
          getZedResponsePolicy(cognitiveVoiceMode),
          systemPrompt || "",
          adminCtx.text,
          knowledge.prompt,
        ]
          .filter(Boolean)
          .join("\n\n");
      } catch (memErr) {
        console.warn("[SSE] Memory injection failed (non-fatal):", memErr);
      }

      if (!systemPrompt) {
        const strategicReasoning = ZedStrategicReasoningEngine.prepare({
          userMessage: content,
          lane: "chat",
          knowledgePresent: false,
          currentContext: { conversationId, isAdmin },
        });
        cognitiveStrategicActive = strategicReasoning.active;
        cognitiveVoiceMode = strategicReasoning.active ? "strategy" : "chat";
        systemPrompt = [
          ZED_IDENTITY_PROMPT,
          buildZedGovernancePrompt({ userMessage: content, lane: cognitiveVoiceMode }),
          ZedPrincipleEngine.buildPrompt({
            userMessage: content,
            lane: cognitiveVoiceMode,
            knowledgePresent: false,
            isAdmin,
          }),
          strategicReasoning.prompt,
          await buildZedVoicePrompt({ mode: cognitiveVoiceMode }),
          getZedResponsePolicy(cognitiveVoiceMode),
        ].join("\n\n");
      }

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        let fullResponse = "";

        res.write(
          `data: ${JSON.stringify({ type: "user_message", message: userMessage })}\n\n`,
        );

        await streamChatFromOllama(
          ollamaMessages,
          systemPrompt,
          (token) => {
            fullResponse += token;
          },
          async () => {
            const presentedResponse = await presentZedResponse(fullResponse || "(no response)", {
              userMessage: content,
              includeSources,
              mode: cognitiveVoiceMode,
              grounded: true,
            });
            const aiMessage = await storage.createMessage(
              insertMessageSchema.parse({
                conversationId,
                role: "assistant",
                content: presentedResponse,
              }),
            );
            await KnowledgeService.persistInteraction({
              userId,
              conversationId,
              userContent: content,
              assistantContent: aiMessage.content,
              tags: ["chat", "conversation"],
            });
            await ZedReflectionEngine.reflectAfterReply({
              userId,
              conversationId,
              userMessage: content,
              assistantReply: aiMessage.content,
              route: "chat",
              strategic: cognitiveStrategicActive,
              tags: ["chat", "conversation", "cognitive-core"],
            }).catch((err) => {
              void logRuntimeEvent({
                level: "warn",
                source: "server",
                event: "reflection.failed",
                detail: err?.message || String(err),
                context: { conversationId },
              });
            });
            res.write(`data: ${JSON.stringify({ type: "token", token: presentedResponse })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: "done", message: aiMessage })}\n\n`);
            res.end();
          },
          async (err) => {
            console.error("[SSE] stream error:", err);
            const fallback = "ZED's model host is not reachable right now. Check the active AI provider settings and try again.";
            const presentedFallback = await presentZedResponse(fallback, {
              userMessage: content,
              includeSources,
              mode: "chat",
              grounded: true,
            });
            const aiMessage = await storage.createMessage(
              insertMessageSchema.parse({
                conversationId,
                role: "assistant",
                content: presentedFallback,
              }),
            );
            res.write(
              `data: ${JSON.stringify({ type: "error", message: aiMessage, error: presentedFallback })}\n\n`,
            );
            res.end();
          },
          { lane: "chat" },
        );
      } else {
        let aiText: string;
        try {
          aiText = await generateChatFromOllama(ollamaMessages, systemPrompt, { lane: "chat" });
        } catch (err: any) {
          aiText = "ZED's model host is not reachable right now. Check the active AI provider settings and try again.";
        }
        const presentedText = await presentZedResponse(aiText, {
          userMessage: content,
          includeSources,
          mode: cognitiveVoiceMode,
          grounded: true,
        });
        const aiMessage = await storage.createMessage(
          insertMessageSchema.parse({
            conversationId,
            role: "assistant",
            content: presentedText,
          }),
        );
        await KnowledgeService.persistInteraction({
          userId,
          conversationId,
          userContent: content,
          assistantContent: aiMessage.content,
          tags: ["chat", "conversation"],
        });
        await ZedReflectionEngine.reflectAfterReply({
          userId,
          conversationId,
          userMessage: content,
          assistantReply: aiMessage.content,
          route: "chat",
          strategic: cognitiveStrategicActive,
          tags: ["chat", "conversation", "cognitive-core"],
        }).catch((err) => {
          void logRuntimeEvent({
            level: "warn",
            source: "server",
            event: "reflection.failed",
            detail: err?.message || String(err),
            context: { conversationId },
          });
        });
        res.json({ userMessage, aiMessage });
      }
    } catch (error) {
      console.error("[Messages] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Message processing failed" });
      }
    }
  });
}
