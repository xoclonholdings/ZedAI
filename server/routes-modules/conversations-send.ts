import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { storage } from "../storage/databaseStorage";
import { insertMessageSchema } from "../../shared/schema";
import { checkTiers } from "../middleware/TierEnforcement";
import { ManagerAgent } from "../orchestrator/ManagerAgent";
import { KnowledgeService } from "../services/KnowledgeService";
import { injectMemory } from "../services/MemoryInjector";
import {
  generateChatFromOllama,
  streamChatFromOllama,
  type OllamaMessage,
} from "../services/Ollama/OllamaService";
import { buildZedAdminContext } from "../services/ZedContextBuilder";
import { getZedResponsePolicy } from "../services/ZedResponsePolicy";
import {
  buildZedGovernancePrompt,
  governZedResponse,
  userRequestedSourceLinks,
} from "../services/ZedResponseGovernance";
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

      const includeSources = userRequestedSourceLinks(content);
      const tierCheck = await checkTiers(
        content,
        req.user?.claims?.sub || "unknown",
        req.ip || "",
      );
      if (tierCheck.blocked) {
        const blockedMsg = await storage.createMessage(
          insertMessageSchema.parse({
            conversationId,
            role: "assistant",
            content: governZedResponse(tierCheck.reply, { userMessage: content, includeSources }),
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

      if (isWebLookupIntent(content)) {
        try {
          const isAdmin = !!req.user?.claims?.isAdmin;
          const result = await ManagerAgent.route({
            userId: req.user?.claims?.sub || "unknown",
            message: content,
            conversationId,
            ip: req.ip || "",
            targetAgent: "research",
            context: { isAdmin },
          });
          const governedReply = governZedResponse(result.reply || "(no response)", {
            userMessage: content,
            includeSources,
          });
          const aiMessage = await storage.createMessage(
            insertMessageSchema.parse({
              conversationId,
              role: "assistant",
              content: governedReply,
            }),
          );
          await KnowledgeService.persistInteraction({
            userId: req.user?.claims?.sub || "unknown",
            conversationId,
            userContent: content,
            assistantContent: aiMessage.content,
            tags: ["chat", "web", "research"],
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

      const history = await storage.getMessagesByConversation(conversationId);
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
        const isAdmin = !!req.user?.claims?.isAdmin;
        const memCtx = await injectMemory("ChatMode", { includeFoundation: isAdmin });
        const knowledge = await KnowledgeService.buildContext({
          userId: req.user.claims.sub,
          query: content,
          conversationId,
          lane: "chat",
          injectedMemory: memCtx.formatted,
          includeAdminFoundation: isAdmin,
        });
        const adminCtx = await buildZedAdminContext({
          userId: req.user?.claims?.sub,
          conversationId,
        });
        systemPrompt = [
          ZED_IDENTITY_PROMPT,
          buildZedGovernancePrompt({
            userMessage: content,
            lane: "chat",
            knowledgePresent: Boolean(knowledge.prompt || adminCtx.text || systemPrompt),
          }),
          getZedResponsePolicy("chat"),
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
        systemPrompt = [
          ZED_IDENTITY_PROMPT,
          buildZedGovernancePrompt({ userMessage: content, lane: "chat" }),
          getZedResponsePolicy("chat"),
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
            const governedResponse = governZedResponse(fullResponse || "(no response)", {
              userMessage: content,
              includeSources,
            });
            const aiMessage = await storage.createMessage(
              insertMessageSchema.parse({
                conversationId,
                role: "assistant",
                content: governedResponse,
              }),
            );
            await KnowledgeService.persistInteraction({
              userId: req.user.claims.sub,
              conversationId,
              userContent: content,
              assistantContent: aiMessage.content,
              tags: ["chat", "conversation"],
            });
            res.write(`data: ${JSON.stringify({ type: "token", token: governedResponse })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: "done", message: aiMessage })}\n\n`);
            res.end();
          },
          async (err) => {
            console.error("[SSE] stream error:", err);
            const fallback = "ZED's model host is not reachable right now. Check the active AI provider settings and try again.";
            const aiMessage = await storage.createMessage(
              insertMessageSchema.parse({
                conversationId,
                role: "assistant",
                content: governZedResponse(fallback, { userMessage: content, includeSources }),
              }),
            );
            res.write(
              `data: ${JSON.stringify({ type: "error", message: aiMessage, error: fallback })}\n\n`,
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
        const governedText = governZedResponse(aiText, { userMessage: content, includeSources });
        const aiMessage = await storage.createMessage(
          insertMessageSchema.parse({
            conversationId,
            role: "assistant",
            content: governedText,
          }),
        );
        await KnowledgeService.persistInteraction({
          userId: req.user.claims.sub,
          conversationId,
          userContent: content,
          assistantContent: aiMessage.content,
          tags: ["chat", "conversation"],
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
