/**
 * IntelligenceSubagent: Research and Analysis (R&D Agent)
 * Inherits IntelligenceAgent rules and autonomously activates on web/research requests.
 */

import { SubagentBase } from "../SubagentBase";
import type {
  SubagentContext,
  SubagentLaneDecision,
  SubagentResult,
  CapabilityLevel,
} from "../SubagentTypes";

const RESEARCH_KEYWORDS = [
  "research", "find information", "analyze", "trend", "market", "github", "news",
  "what is", "how does", "who is", "explain", "summarize", "what are", "latest", "current",
  "current events", "happening in", "tell me about", "website", "webpage", "url", "browse", "visit", "inspect",
];

export class IntelligenceSubagent extends SubagentBase {
  constructor() {
    super("IntelligenceSubagent", ["intelligence"], "intelligence");
  }

  protected async decideLane(context: SubagentContext): Promise<SubagentLaneDecision> {
    // Explicit targeting
    if (context.explicitLane === "intelligence") {
      return {
        laneName: "intelligence",
        activated: true,
        confidence: 1.0,
        detectionMethod: "explicit_target",
        reason: "Explicitly targeted to Intelligence lane",
      };
    }

    // Web lookup intent (URL, domain, research keywords)
    const hasUrl =
      /\bhttps?:\/\/[^\s)]+/i.test(context.message) ||
      /\bwww\.[^\s)]+/i.test(context.message) ||
      /\b[a-z0-9-]+(\.[a-z0-9-]+)+\/?[^\s)]*\b/i.test(context.message);

    if (hasUrl) {
      return {
        laneName: "intelligence",
        activated: true,
        confidence: 0.95,
        detectionMethod: "keyword",
        reason: "URL/domain detected in message",
      };
    }

    // Research keyword detection
    const lowerMessage = context.message.toLowerCase();
    const hasResearchKeyword = RESEARCH_KEYWORDS.some((kw) => lowerMessage.includes(kw));

    if (hasResearchKeyword) {
      return {
        laneName: "intelligence",
        activated: true,
        confidence: 0.8,
        detectionMethod: "keyword",
        reason: "Research-related keywords detected",
      };
    }

    return {
      laneName: "intelligence",
      activated: false,
      confidence: 0,
      detectionMethod: "fallback",
      reason: "No research/intelligence keywords or URLs detected",
    };
  }

  protected async determineCapabilities(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision
  ): Promise<CapabilityLevel[]> {
    const capabilities: CapabilityLevel[] = ["retrieval"];

    if (context.message.toLowerCase().includes("analyze")) {
      capabilities.push("analysis");
    }

    if (context.message.toLowerCase().includes("summarize") || context.message.toLowerCase().includes("trend")) {
      capabilities.push("synthesis");
    }

    capabilities.push("reasoning");

    return capabilities;
  }

  protected async executeLane(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision,
    capabilities: CapabilityLevel[]
  ): Promise<SubagentResult> {
    const responseText = `Intelligence Analysis:\n- Web research enabled\n- Knowledge graph retrieval active\n- Document analysis available\n- Trend synthesis enabled\n\nCapabilities: ${capabilities.join(", ")}`;

    return {
      subagentName: this.name,
      laneName: "intelligence",
      activated: true,
      responseText,
      reasoning: "IntelligenceSubagent identified research intent and prepared retrieval pipeline.",
      actionItems: capabilities.includes("retrieval")
        ? [
            {
              type: "web_search",
              description: "Retrieve latest information on request topic",
              requiresApproval: false,
            },
            {
              type: "knowledge_graph_query",
              description: "Query knowledge graph for related insights",
              requiresApproval: false,
            },
          ]
        : [],
      metadata: {
        confidence: laneDecision.confidence,
        priority: 2,
        sources: [],
      },
      trace: {
        subagentName: this.name,
        laneName: "intelligence",
        activated: true,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        laneDecision,
        capabilities,
        actionsRequested: [
          { type: "web_search", approvalRequired: false },
          { type: "knowledge_graph_query", approvalRequired: false },
        ],
        servicesInvoked: ["IntelligenceAgent", "WebSearchService", "KnowledgeService"],
        toolsInvoked: [],
        status: "success",
      },
    };
  }
}
