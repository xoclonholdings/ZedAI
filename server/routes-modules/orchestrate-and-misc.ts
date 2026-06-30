import type { Express } from "express";

import { isAdmin, isAuthenticated } from "../localAuth";
import { storage } from "../storage/databaseStorage";
import { insertMessageSchema } from "../../shared/schema";
import { ZedAutonomousOrchestrator } from "../zcos/orchestration/ZedAutonomousOrchestrator";
import { KnowledgeService } from "../services/KnowledgeService";
import { KnowledgeCurationEngine } from "../services/KnowledgeCurationEngine";
import { ContextInquiryEngine } from "../services/knowledge-ingestion/ContextInquiryEngine";
import { injectMemory } from "../services/MemoryInjector";
import {
  checkOllamaHealth,
  generateFromOllama,
} from "../services/Ollama/OllamaService";
import { buildOllamaPrompt } from "../services/Ollama/OllamaContextBuilder";
import {
  getActiveProviderName,
  getResolvedTargetName,
} from "../core/providers/provider-executor";
import { getZedResponsePolicy } from "../services/ZedResponsePolicy";
import {
  buildZedGovernancePrompt,
  governZedResponse,
  userRequestedProcessDisclosure,
  userRequestedSourceLinks,
} from "../services/ZedResponseGovernance";
import {
  getPublicAdminSettings,
  loadAdminSettings,
} from "../services/AdminSettingsStore";

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
 * Orchestrator + a handful of small one-shot endpoints. They live
 * together because each is too small to deserve its own module but
 * they share dependencies (provider executor, KnowledgeService,
 * AdminSettingsStore).
 *
 * Endpoints:
 *   POST /api/orchestrate           Autonomous ZED dispatch through ZCOS
 *   GET  /api/orchestrate/status    Active vs planned agents + integrations
 *   POST /api/voice/transcribe      Stub for future Whisper integration
 *   GET  /api/admin/knowledge/overview  Counts + curation health for the admin Knowledge tab
 *   GET  /api/admin/system-test     Cheap status probe (no auth)
 *   POST /api/chat                  Bare-bones single-shot chat (no auth)
 */
export function registerOrchestrateAndMiscRoutes(
  app: Express,
  opts: { isDatabaseHealthy: () => boolean },
): void {
  app.post("/api/orchestrate", isAuthenticated, async (req: any, res) => {
    try {
      const { message, conversationId, targetAgent } = req.body;
      const userId = req.user.claims.sub;
      if (!message) return res.status(400).json({ error: "Message required" });

      if (conversationId) {
        await storage.createMessage(
          insertMessageSchema.parse({
            conversationId,
            role: "user",
            content: message,
          }),
        );
      }

      try {
        const contextAssessmentResult = await ContextInquiryEngine.assess({ userInput: message });
        const assessment = contextAssessmentResult.assessment;
        const topQuestion = selectTopContextQuestion(assessment.questions);

        if (assessment.responsePolicy === "inquire_first" && topQuestion) {
          const reply = governZedResponse(formatContextInquiryReply(topQuestion.question), {
            userMessage: message,
            includeSources: false,
          });
          const inquiryResponse = {
            reply,
            agent: "ManagerAgent",
            requiresApproval: false,
            metadata: {
              contextInquiry: true,
              contextAssessment: compactContextAssessment(assessment, topQuestion),
            },
          };

          if (conversationId) {
            await storage.createMessage(
              insertMessageSchema.parse({
                conversationId,
                role: "assistant",
                content: reply,
                metadata: {
                  agent: inquiryResponse.agent,
                  requiresApproval: inquiryResponse.requiresApproval,
                  contextInquiry: true,
                  contextAssessment: inquiryResponse.metadata.contextAssessment,
                },
              }),
            );
          }

          return res.json(inquiryResponse);
        }
      } catch (error) {
        console.error("[ContextInquiry] Assessment failed:", error);
      }

      const ip = req.ip || "";
      const knowledge = await KnowledgeService.buildContext({
        userId,
        query: message,
        conversationId,
        lane: "manager",
        injectedMemory: (
          await injectMemory("ManagerAgent", {
            includeFoundation: !!req.user?.claims?.isAdmin,
          }).catch(() => ({ formatted: "" }))
        ).formatted,
        includeAdminFoundation: !!req.user?.claims?.isAdmin,
      });

      const response = await ZedAutonomousOrchestrator.route({
        userId,
        message,
        conversationId,
        ip,
        targetAgent,
        context: {
          ...(req.body?.context || {}),
          knowledgePrompt: knowledge.prompt,
          isAdmin: Boolean(req.user?.claims?.isAdmin),
        },
      });
      const governedResponse = {
        ...response,
        reply: governZedResponse(response.reply, {
          userMessage: message,
          includeSources: userRequestedSourceLinks(message),
        }),
      };

      if (conversationId) {
        await storage.createMessage(
          insertMessageSchema.parse({
            conversationId,
            role: "assistant",
            content: governedResponse.reply,
            metadata: {
              agent: governedResponse.agent,
              requiresApproval: governedResponse.requiresApproval,
              autonomous: governedResponse.metadata?.autonomous,
              flowRecommendation: governedResponse.metadata?.flowRecommendation,
            },
          }),
        );
      }

      res.json(governedResponse);
    } catch (error) {
      console.error("[Orchestrator] Error:", error);
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "The selected agent is temporarily unavailable.";
      res.json({
        error: "Orchestration failed",
        reply: governZedResponse(`ZED orchestration is unavailable right now: ${detail}`, {
          userMessage: String(req.body?.message || ""),
        }),
        agent: "ManagerAgent",
      });
    }
  });

  app.get("/api/orchestrate/status", async (_req, res) => {
    const settings = await getPublicAdminSettings();
    const normalizedAgents = settings.agents.map((agent) => {
      if (agent.key === "BusinessManagerAgent") {
        const isBusinessReady = settings.integrations.businessOperations.enabled;
        return {
          ...agent,
          status: (isBusinessReady ? "active" : "planned") as "active" | "planned",
          description: isBusinessReady
            ? "Business operations lane is enabled for commerce, property, credit, and planning workflows."
            : agent.description,
        };
      }
      return agent;
    });
    res.json({
      orchestrator: "ManagerAgent",
      active_agents: normalizedAgents.filter((a) => a.status === "active"),
      planned_agents: normalizedAgents.filter((a) => a.status === "planned"),
      integrations: settings.integrations,
      status: "operational",
    });
  });

  app.post("/api/voice/transcribe", isAuthenticated, async (_req: any, res) => {
    res.json({
      transcript: "",
      note: "Server-side transcription requires Whisper. Using browser Speech API instead.",
    });
  });

  app.get("/api/admin/knowledge/overview", isAdmin, async (_req, res) => {
    try {
      const settings = await loadAdminSettings();
      const defaultUserId = settings.users?.[0]?.id || "admin-user";
      const { MemoryService } = await import("../services/memoryService");
      const [core, project, scratchpad, curation] = await Promise.all([
        MemoryService.getAllCoreMemory(),
        MemoryService.getProjectMemory(defaultUserId).catch(() => []),
        MemoryService.getScratchpadMemory(defaultUserId).catch(() => []),
        KnowledgeCurationEngine.getLatestReview().catch(() => null),
      ]);
      res.json({
        coreCount: core.length,
        projectCount: project.length,
        scratchpadCount: scratchpad.length,
        curation: curation
          ? {
              generatedAt: curation.generatedAt,
              averageHealthScore: curation.summary.averageHealthScore,
              needsReviewCount: curation.summary.needsReviewCount,
              duplicateGroupCount: curation.summary.duplicateGroupCount,
              contradictionCount: curation.summary.contradictionCount,
              orphanedCount: curation.summary.orphanedCount,
              learningGapCount: curation.summary.learningGapCount,
              recommendedQuestionCount: curation.recommendedQuestions.length,
            }
          : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to load knowledge overview" });
    }
  });

  app.get("/api/admin/system-test", async (_req, res) => {
    const ollama = await checkOllamaHealth();
    res.json({
      system: "ZED",
      ai: getActiveProviderName({ lane: "chat" }),
      target: getResolvedTargetName({ lane: "chat" }),
      ollama: ollama.status,
      database: opts.isDatabaseHealthy() ? "connected" : "offline",
    });
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message required" });
      const governancePrompt = buildZedGovernancePrompt({
        userMessage: message,
        lane: "chat",
      });
      const prompt = buildOllamaPrompt(message, {
        memory: [governancePrompt, getZedResponsePolicy("chat")].join("\n\n"),
      });
      const options = { lane: "chat" as const };
      const rawReply = await generateFromOllama(prompt, options);
      const reply = governZedResponse(rawReply, {
        userMessage: message,
        includeSources: userRequestedSourceLinks(message),
      });
      const payload: Record<string, unknown> = { reply };
      if (userRequestedProcessDisclosure(message)) {
        payload.provider = getActiveProviderName(options);
        payload.target = getResolvedTargetName(options);
      }
      res.json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Chat failed",
        reply: "ZED's model host is not reachable right now. Check the active AI provider settings and try again.",
      });
    }
  });
}
