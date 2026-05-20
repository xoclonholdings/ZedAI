import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { OperationsAgent, type AgentRequest, type AgentResponse } from "../agents/operations/OperationsAgent";
import { IntelligenceAgent, type ResearchRequest } from "../agents/intelligence/IntelligenceAgent";
import { BusinessManagerAgent } from "../agents/business-manager/BusinessManagerAgent";
import { FinanceAgent } from "../agents/finance/FinanceAgent";
import { KnowledgeService } from "../services/KnowledgeService";
import { generateChatFromOllama } from "../services/Ollama/OllamaService";
import { logRuntimeEvent } from "../services/RuntimeLogger";
import { checkTiers, filterOutputForTier3 } from "../middleware/TierEnforcement";
import { HUB_CONFIG_DIR, HUB_LOG_DIR } from "../utils/repoPaths";

const CONFIG_DIR = HUB_CONFIG_DIR;
const LOG_DIR = HUB_LOG_DIR;

interface HubConfig {
  personality: any;
  security: any;
  parameters: any;
  access: any;
}

interface OrchestratorRequest {
  userId: string;
  message: string;
  conversationId?: string;
  context?: Record<string, any>;
  ip?: string;
  targetAgent?: "operations" | "research" | "business" | "finance";
}

interface OrchestratorResponse {
  reply: string;
  agent: string;
  requiresApproval?: boolean;
  pendingApproval?: string;
  blocked?: boolean;
  tier?: number;
  metadata?: Record<string, any>;
}

type AgentName = "OperationsAgent" | "IntelligenceAgent" | "BusinessManagerAgent" | "FinanceAgent";

export class ManagerAgent {
  private static config: HubConfig | null = null;

  static async loadConfig(): Promise<HubConfig> {
    if (this.config) return this.config;

    const loadYaml = async (filename: string) => {
      try {
        const raw = await fs.readFile(path.join(CONFIG_DIR, filename), "utf-8");
        return yaml.load(raw) as any;
      } catch {
        console.warn(`[ManagerAgent] Could not load ${filename}, using defaults`);
        return {};
      }
    };

    this.config = {
      personality: await loadYaml("personality.yaml"),
      security: await loadYaml("security.yaml"),
      parameters: await loadYaml("parameters.yaml"),
      access: await loadYaml("access.yaml"),
    };

    return this.config;
  }

  static async route(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const config = await this.loadConfig();

    const tierCheck = await checkTiers(request.message, request.userId, request.ip || "unknown");
    if (tierCheck.blocked) {
      return {
        reply: tierCheck.reply,
        agent: "ManagerAgent",
        blocked: true,
        tier: tierCheck.tier,
      };
    }

    const knowledgePrompt =
      typeof request.context?.knowledgePrompt === "string"
        ? request.context.knowledgePrompt
        : (
            await KnowledgeService.buildContext({
              userId: request.userId,
              query: request.message,
              conversationId: request.conversationId,
              lane: "manager",
            })
          ).prompt;

    const agent = await this.selectAgent(request.message, config, request.targetAgent);
    console.log(`[ManagerAgent] Routing to ${agent} for user ${request.userId}`);
    await this.logRouting(request, agent);

    let reply: string;
    let extra: Partial<OrchestratorResponse> = {};

    switch (agent) {
      case "IntelligenceAgent": {
        const researchReq: ResearchRequest = {
          userId: request.userId,
          query: request.message,
          depth: this.isWebLookupIntent(request.message) || request.message.length > 100 ? "deep" : "shallow",
          conversationId: request.conversationId,
          memoryContext: knowledgePrompt,
        };
        const brief = await IntelligenceAgent.research(researchReq);
        reply = this.formatBrief(brief);
        extra = { metadata: { brief } };
        break;
      }

      case "BusinessManagerAgent": {
        const resp = await BusinessManagerAgent.process({
          userId: request.userId,
          task: request.message,
          conversationId: request.conversationId,
          memoryContext: knowledgePrompt,
        });
        return {
          reply: filterOutputForTier3(resp.message),
          agent: resp.agent,
          requiresApproval: resp.requiresApproval,
          metadata: {
            planned: resp.planned,
            capabilities: resp.capabilities,
            integration: "Business Operations",
          },
        };
      }

      case "FinanceAgent": {
        const resp = await FinanceAgent.process({
          userId: request.userId,
          task: request.message,
          conversationId: request.conversationId,
          memoryContext: knowledgePrompt,
        });
        return {
          reply: filterOutputForTier3(resp.message),
          agent: resp.agent,
          requiresApproval: resp.requiresApproval,
          metadata: { capabilities: resp.capabilities },
        };
      }

      case "OperationsAgent":
      default: {
        const opReq: AgentRequest = {
          userId: request.userId,
          message: request.message,
          conversationId: request.conversationId,
          context: request.context,
          memoryContext: knowledgePrompt,
        };
        const opResp: AgentResponse = await OperationsAgent.process(opReq);
        reply = opResp.reply;
        extra = {
          requiresApproval: opResp.requiresApproval,
          metadata: { actions: opResp.actions },
        };
        break;
      }
    }

    reply = filterOutputForTier3(reply);

    return {
      reply,
      agent,
      ...extra,
    };
  }

  private static async selectAgent(
    message: string,
    config: HubConfig,
    targetAgent?: OrchestratorRequest["targetAgent"],
  ): Promise<AgentName> {
    // Web / URL inspection is a capability intent, not a personality lane.
    // Route it to IntelligenceAgent even if the user currently has another lane selected.
    if (this.isWebLookupIntent(message)) {
      await logRuntimeEvent({
        level: "info",
        source: "server",
        event: "manager.route.web_intent",
        detail: "Web / URL lookup intent routed to IntelligenceAgent",
      });
      return "IntelligenceAgent";
    }

    // Explicit user pick from the UI pill wins after capability routing.
    if (targetAgent === "operations") return "OperationsAgent";
    if (targetAgent === "research") return "IntelligenceAgent";
    if (targetAgent === "business") return "BusinessManagerAgent";
    if (targetAgent === "finance") return "FinanceAgent";

    const classified = await this.classifyWithLlm(message);
    if (classified) return classified;

    return this.classifyWithKeywords(message, config);
  }

  private static isWebLookupIntent(message: string): boolean {
    const lower = message.toLowerCase();

    const hasUrl =
      /\bhttps?:\/\/[^\s)]+/i.test(message) ||
      /\bwww\.[^\s)]+/i.test(message) ||
      /\b[a-z0-9-]+(\.[a-z0-9-]+)+\/?[^\s)]*/i.test(message);

    const webIntentPhrases = [
      "visit",
      "open this site",
      "open the site",
      "go to",
      "browse",
      "inspect",
      "check this site",
      "check the site",
      "look at this site",
      "look up",
      "search web",
      "search the web",
      "google",
      "latest",
      "current",
      "news",
      "what does this website",
      "analyze this website",
      "audit this website",
      "review this website",
      "summarize this page",
      "summarize this website",
    ];

    return hasUrl || webIntentPhrases.some((phrase) => lower.includes(phrase));
  }

  private static async classifyWithLlm(message: string): Promise<AgentName | null> {
    const trimmed = message.trim();
    if (!trimmed) return null;

    const systemPrompt = [
      "You are a routing classifier for the ZED multi-agent system.",
      "Choose exactly one agent for the user's message based on the descriptions below.",
      "",
      "operations  — calendar, email drafting, scheduling, voicemail, posts, invoices, cancellations, bookings, generic personal assistant work.",
      "research    — external websites, URLs, browsing requests, latest/current information, explanations, market scans, trend summaries, comparisons, deep research, 'what is / how does / latest news' questions.",
      "business    — payroll, contractors, ecommerce/dropshipping, real estate, business credit, acquisitions, business operations.",
      "finance     — crypto, forex, trading setups, position management, wealth planning, yield, portfolio strategy.",
      "",
      "Important: Any request containing a URL, website, browse, visit, inspect, current, latest, or news intent must route to research.",
      "",
      "Reply with EXACTLY one lowercase label: operations | research | business | finance.",
      "Do not include punctuation, quotes, or explanations.",
    ].join("\n");

    try {
      const reply = await generateChatFromOllama(
        [{ role: "user", content: trimmed.slice(0, 1200) }],
        systemPrompt,
        { lane: "manager" },
      );
      const label = (reply || "").trim().toLowerCase().replace(/[^a-z]/g, "");
      const map: Record<string, AgentName> = {
        operations: "OperationsAgent",
        research: "IntelligenceAgent",
        business: "BusinessManagerAgent",
        finance: "FinanceAgent",
      };
      const picked = map[label];
      if (!picked) {
        await logRuntimeEvent({
          level: "warn",
          source: "server",
          event: "manager.classify.unmapped",
          detail: `Classifier returned unmapped label: ${(reply || "").slice(0, 60)}`,
        });
        return null;
      }
      await logRuntimeEvent({
        level: "info",
        source: "server",
        event: "manager.classify.ok",
        detail: `Classifier picked ${picked}`,
      });
      return picked;
    } catch (err: any) {
      await logRuntimeEvent({
        level: "warn",
        source: "server",
        event: "manager.classify.failed",
        detail: err?.message || String(err),
      });
      return null;
    }
  }

  private static classifyWithKeywords(message: string, config: HubConfig): AgentName {
    const lower = message.toLowerCase();
    const params = config.parameters || {};

    if (this.isWebLookupIntent(message)) return "IntelligenceAgent";

    const financeKeywords = [
      "crypto",
      "bitcoin",
      "btc",
      "ethereum",
      "eth",
      "solana",
      "sol",
      "token",
      "altcoin",
      "defi",
      "web3",
      "nft",
      "on-chain",
      "wallet",
      "forex",
      "fx",
      "eurusd",
      "gbpusd",
      "usdjpy",
      "currency pair",
      "trade",
      "trading",
      "long position",
      "short position",
      "stop loss",
      "take profit",
      "portfolio",
      "rebalance",
      "wealth",
      "compound",
      "allocation",
      "yield",
      "stablecoin",
    ];

    if (financeKeywords.some((keyword) => lower.includes(keyword))) return "FinanceAgent";

    const businessKeywords = [
      "payroll",
      "gusto",
      "contractor",
      "employee",
      "onboarding",
      "benefits",
      "reimbursement",
      "w-2",
      "1099",
      "business manager",
      "dropshipping",
      "ecommerce",
      "business credit",
      "property",
      "real estate",
      "acquisition",
      "deal flow",
      "underwriting",
    ];

    if (businessKeywords.some((keyword) => lower.includes(keyword))) return "BusinessManagerAgent";

    const opsKeywords = [
      "calendar",
      "schedule",
      "reschedule",
      "meeting",
      "appointment",
      "email",
      "send email",
      "draft email",
      "reply to",
      "task",
      "todo",
      "to-do",
      "to do",
      "remind me",
      "post to",
      "post on",
      "publish",
      "tweet",
      "draft post",
      "send invoice",
      "invoice",
      "cancel",
      "book ",
      "call",
      "voicemail",
      "phone",
    ];

    if (opsKeywords.some((keyword) => lower.includes(keyword))) return "OperationsAgent";

    const researchKeywords: string[] = params.agent_routing?.research_keywords || [
      "research",
      "find information",
      "analyze",
      "trend",
      "market",
      "github",
      "news",
      "what is",
      "how does",
      "who is",
      "explain",
      "summarize",
      "what are",
      "latest",
      "current",
      "current events",
      "happening in",
      "tell me about",
      "website",
      "url",
      "browse",
      "visit",
      "inspect",
    ];

    if (researchKeywords.some((keyword) => lower.includes(keyword))) return "IntelligenceAgent";

    return "OperationsAgent";
  }

  private static formatBrief(brief: any): string {
    const keyFindings = Array.isArray(brief?.keyFindings) ? brief.keyFindings : [];
    const implications = (brief?.implications || "").trim();
    const recommendedAction = (brief?.recommendedAction || "").trim();
    const topic = brief?.topic || "your request";
    const diagnostics = brief?.diagnostics || {};

    // When the research pipeline produced nothing real, explain what
    // happened and what the user can do — never paper over with
    // "No key findings returned." or "See full response for details."
    if (keyFindings.length === 0 && !implications && !recommendedAction) {
      const { searchResultsCount = 0, searchSource = "none", rawOutputLength = 0 } = diagnostics;

      let reason: string;
      if (searchSource === "none") {
        reason = "no web search provider is configured, so I could not fetch live information";
      } else if (searchResultsCount === 0) {
        reason = `the ${searchSource} web search returned no results for "${topic}"`;
      } else if (rawOutputLength === 0) {
        reason = "the local model returned an empty response";
      } else {
        reason = "the local model returned content I couldn't parse into a structured brief";
      }

      const options = [
        "Rephrase the request with more specific keywords or context",
        "Switch the lane to **Chat** if you want a direct conversational answer instead of a research brief",
        "Open Admin → Integrations and enable a web search provider (Brave or Serper) if live data is needed",
      ];

      return [
        `I am unable to produce a research brief on **${topic}** because ${reason}.`,
        "",
        "Here are some options:",
        ...options.map((o) => `- ${o}`),
      ].join("\n");
    }

    // We have at least some real content. Render only the sections
    // that actually have content — no empty placeholders.
    const sections: string[] = [`**Research Brief: ${topic}**`];
    if (brief?.confidence) sections.push(`**Confidence**: ${brief.confidence}`);
    if (keyFindings.length > 0) {
      sections.push(
        `**Key Findings**:\n${keyFindings.map((f: string) => `- ${f}`).join("\n")}`,
      );
    }
    if (implications) sections.push(`**Implications**: ${implications}`);
    if (recommendedAction) sections.push(`**Recommended Action**: ${recommendedAction}`);

    return sections.join("\n\n");
  }

  static flushConfig(): void {
    this.config = null;
    console.log("[ManagerAgent] Config cache flushed; will reload from disk on next request");
  }

  private static async logRouting(request: OrchestratorRequest, agent: AgentName): Promise<void> {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      const date = new Date().toISOString().split("T")[0];
      const logFile = path.join(LOG_DIR, `routing-${date}.log`);
      const entry =
        JSON.stringify({
          timestamp: new Date().toISOString(),
          userId: request.userId,
          agent,
          messageLength: request.message.length,
          conversationId: request.conversationId,
        }) + "\n";
      await fs.appendFile(logFile, entry);
    } catch {}
  }
}