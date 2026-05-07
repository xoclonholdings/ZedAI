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
          depth: request.message.length > 100 ? "deep" : "shallow",
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
          reply: resp.message,
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
          reply: resp.message,
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
    // Explicit user pick from the UI pill always wins.
    if (targetAgent === "operations") return "OperationsAgent";
    if (targetAgent === "research") return "IntelligenceAgent";
    if (targetAgent === "business") return "BusinessManagerAgent";
    if (targetAgent === "finance") return "FinanceAgent";

    // LLM intent classifier — primary path.
    const classified = await this.classifyWithLlm(message);
    if (classified) return classified;

    // Keyword matcher — deterministic fallback when the LLM is offline,
    // returns garbage, or rate-limits us.
    return this.classifyWithKeywords(message, config);
  }

  /**
   * One-shot LLM intent classifier. Asks the active model to pick exactly
   * one agent label and parses the response. Returns null when the call
   * fails or the response can't be mapped to a known agent.
   */
  private static async classifyWithLlm(message: string): Promise<AgentName | null> {
    const trimmed = message.trim();
    if (!trimmed) return null;

    const systemPrompt = [
      "You are a routing classifier for the ZED multi-agent system.",
      "Choose exactly one agent for the user's message based on the descriptions below.",
      "",
      "operations  — calendar, email drafting, scheduling, voicemail, posts, invoices, cancellations, bookings, generic personal assistant work.",
      "research    — explanations, market scans, trend summaries, comparisons, deep research, 'what is / how does / latest news' questions.",
      "business    — payroll, contractors, ecommerce/dropshipping, real estate, business credit, acquisitions, business operations.",
      "finance     — crypto, forex, trading setups, position management, wealth planning, yield, portfolio strategy.",
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

  /**
   * Deterministic keyword-based fallback. Identical to the previous
   * routing rules; kept so a flaky LLM never breaks the chat.
   */
  private static classifyWithKeywords(message: string, config: HubConfig): AgentName {
    const lower = message.toLowerCase();
    const params = config.parameters || {};

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
      "current events",
      "happening in",
      "tell me about",
    ];

    if (researchKeywords.some((keyword) => lower.includes(keyword))) return "IntelligenceAgent";

    return "OperationsAgent";
  }

  private static formatBrief(brief: any): string {
    const findings = brief.keyFindings.map((finding: string) => `- ${finding}`).join("\n");
    return `**Research Brief: ${brief.topic}**\n\n**Confidence**: ${brief.confidence}\n\n**Key Findings**:\n${findings}\n\n**Implications**: ${brief.implications}\n\n**Recommended Action**: ${brief.recommendedAction}`;
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
