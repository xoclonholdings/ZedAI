import { afterEach, describe, expect, it, vi } from "vitest";

import { storage } from "../storage/databaseStorage";
import {
  ConversationContinuityService,
  detectsSharedContext,
} from "./ConversationContinuityService";
import { buildContextualQuestionForTest, ChatExecutionService } from "./ChatExecutionService";
import { ZcosRequestInterpreter } from "../zcos/runtime/ZcosRequestInterpreter";
import { ZcosUnifiedIntelligenceRuntime } from "../zcos/runtime/ZcosUnifiedIntelligenceRuntime";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ZAR operator continuity and assignment", () => {
  it("detects language that assumes shared context", () => {
    expect(detectsSharedContext("Continue fixing the bug we discussed earlier.")).toBe(true);
    expect(detectsSharedContext("What is photosynthesis?")).toBe(false);
  });

  it("retrieves only owner-scoped prior conversations and excludes the active thread", async () => {
    const conversations = [
      { id: "active", userId: "owner", title: "Current", preview: "", updatedAt: new Date() },
      { id: "prior", userId: "owner", title: "ZAR authentication repair", preview: "Privy login", updatedAt: new Date() },
      { id: "foreign", userId: "different-owner", title: "ZAR authentication repair", preview: "private", updatedAt: new Date() },
    ];
    const conversationSpy = vi.spyOn(storage, "getConversationsByUser").mockResolvedValue(conversations as any);
    const messagesSpy = vi.spyOn(storage, "getMessagesByConversation").mockImplementation(async (conversationId) => ([{
      id: `message-${conversationId}`,
      conversationId,
      role: "user",
      content: conversationId === "prior" ? "We decided to keep Privy as the universal identity provider." : "Current turn",
      metadata: null,
      createdAt: new Date(),
    }] as any));

    const result = await ConversationContinuityService.retrieve({
      userId: "owner",
      message: "Continue the ZAR authentication repair.",
      currentConversationId: "active",
    });

    expect(conversationSpy).toHaveBeenCalledWith("owner");
    expect(messagesSpy).not.toHaveBeenCalledWith("foreign");
    expect(result.evidence.map((item) => item.conversationId)).toEqual(["prior"]);
    expect(result.prompt).toContain("Use this as evidence of prior dialogue only");
    expect(result.prompt).toContain("Privy");
  });

  it("keeps conversation history typed separately from Memory and Knowledge", () => {
    const request = ZcosRequestInterpreter.interpret({
      traceId: "trace-history",
      userId: "owner",
      message: "Continue our plan.",
      route: "/api/orchestrate",
    });
    const prepared = ZcosUnifiedIntelligenceRuntime.prepare({
      request,
      sources: [{
        sourceId: "history-1",
        type: "conversation_history",
        authority: "source",
        originGalaxy: "ZAR",
        originClass: "user_supplied",
        title: "Prior conversation",
        content: "User: Keep the current plan.",
        confidence: 0.75,
        currency: "historical",
        provenance: {
          retrievedAt: new Date().toISOString(),
          independenceKey: "conversation:prior",
          lineage: ["prior"],
        },
      }],
      strategic: false,
      materialUncertainty: false,
      hasFiles: false,
      hasGraphContext: false,
      hasMemory: false,
      configuredIntegrations: new Set(["model_provider"]),
    });

    expect(prepared.sources[0].type).toBe("conversation_history");
    expect(prepared.trace.sourceProvenance[0].type).toBe("conversation_history");
  });

  it("assigns fixing work to ZYNC as a typed blocked assignment when its adapter is unavailable", () => {
    const request = ZcosRequestInterpreter.interpret({
      traceId: "trace-fixing",
      userId: "owner",
      message: "Continue fixing the authentication bug.",
      route: "/api/orchestrate",
    });
    const prepared = ZcosUnifiedIntelligenceRuntime.prepare({
      request,
      sources: [],
      strategic: false,
      materialUncertainty: false,
      hasFiles: false,
      hasGraphContext: false,
      hasMemory: false,
      configuredIntegrations: new Set(["model_provider"]),
    });

    expect(prepared.executionPlan.responseForm).toBe("implementation_task");
    expect(prepared.executionPlan.assignments).toEqual([
      expect.objectContaining({
        ownerGalaxy: "ZYNC",
        capabilityId: "zync.build.delegate",
        status: "blocked",
      }),
    ]);
  });

  it("returns one mobile contextual question with tappable choices and free text", () => {
    const question = buildContextualQuestionForTest({
      question: "Should this remain connected to ZAR",
      category: "relationship",
      choices: ["Keep connected", "Separate it", "Review first"],
    });

    expect(question.prompt).toBe("Should this remain connected to ZAR?");
    expect(question.choices).toEqual(["Keep connected", "Separate it", "Review first"]);
    expect(question.allowFreeText).toBe(true);
  });

  it("returns one ZAR identity without provider or retrieval internals", async () => {
    const result = await ChatExecutionService.execute({
      userId: "owner",
      message: "Hello ZAR.",
      route: "/api/orchestrate",
      persistUserMessage: false,
    }, {
      conversationHistory: async () => ({
        assumesSharedContext: false,
        prompt: "",
        evidence: [],
        lookup: { topicTerms: [], entities: [], projectIds: [] },
      }),
      injectedMemory: async () => ({ formatted: "" }),
      contextAssessment: async () => ({
        assessment: { responsePolicy: "answer_direct", materialUncertainty: false, questions: [] },
      }),
      knowledgeContext: async () => ({ prompt: "", retrievalMode: "private-test-mode" }),
      adminContext: async () => ({ text: "", meta: {} }),
      fileContext: async () => ({ prompt: "", filesReferenced: [], failedFiles: [], imageBlocks: [] }),
      voicePrompt: async () => "",
      route: async () => ({
        reply: "Hello.",
        agent: "OperationsAgent",
        metadata: {
          selectedAgent: "OperationsAgent",
          providerUsed: "private-provider",
          retrievalMode: "private-mode",
        },
      }),
      present: async (draft) => ({ content: draft, adjustments: [] }),
      reflect: async () => undefined,
      log: async () => undefined,
    });

    expect(result.agent).toBe("ZAR");
    expect(result.metadata.agent).toBe("ZAR");
    expect(result.metadata.providerUsed).toBeUndefined();
    expect(result.metadata.retrievalMode).toBeUndefined();
    expect(result.metadata.selectedAgent).toBeUndefined();
    expect(result.trace.providerUsed).toBeUndefined();
  });
});
