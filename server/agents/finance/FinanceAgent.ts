import fs from "fs/promises";
import path from "path";
import { generateChatFromOllama } from "../../services/Ollama/OllamaService";
import { formatResultsForPrompt, webSearch } from "../../services/WebSearchService";
import { querySimilarResearch, storeResearchBrief } from "../../services/ChromaService";
import { HUB_LOG_DIR, HUB_SHARED_MEMORY_DIR, REPO_ROOT } from "../../utils/repoPaths";

const SKILL_PATH = path.resolve(REPO_ROOT, "server/agents/finance/SKILL.md");
const FINANCE_LOG_DIR = path.resolve(HUB_LOG_DIR, "finance");
const FINANCE_MEMORY_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "working/current-tasks.md");

export interface FinanceAgentRequest {
  userId: string;
  task: string;
  conversationId?: string;
  memoryContext?: string;
}

export interface FinanceAgentResponse {
  agent: "FinanceAgent";
  message: string;
  requiresApproval?: boolean;
  capabilities: string[];
}

function detectCapabilities(task: string) {
  const lower = task.toLowerCase();
  const capabilities = new Set<string>();

  if (/(crypto|bitcoin|btc|ethereum|eth|sol|token|altcoin|defi|web3|nft|on-chain|wallet)/.test(lower)) {
    capabilities.add("crypto-web3");
  }
  if (/(forex|fx|eurusd|gbpusd|usdjpy|audusd|currency pair|pip|pips)/.test(lower)) {
    capabilities.add("forex");
  }
  if (/(trade|trading|entry|exit|stop loss|take profit|position|setup|chart|price action|portfolio)/.test(lower)) {
    capabilities.add("trading");
  }
  if (/(wealth|prosperity|capital|compound|allocation|risk|cashflow|returns|net worth)/.test(lower)) {
    capabilities.add("wealth");
  }

  return [...capabilities];
}

function needsApproval(task: string) {
  return /(buy|sell|short|long|open position|close position|rebalance|allocate|move funds|wire|swap)/i.test(task);
}

function expandFinanceQueries(task: string): string[] {
  const lower = task.toLowerCase();
  const queries = new Set<string>([task]);

  if (/(crypto|web3|bitcoin|btc|ethereum|eth|altcoin|defi|token)/.test(lower)) {
    queries.add(`${task} crypto market structure`);
    queries.add(`${task} on-chain catalysts risk`);
    queries.add(`${task} macro correlation liquidity`);
  }

  if (/(forex|fx|eurusd|gbpusd|usdjpy|audusd|currency)/.test(lower)) {
    queries.add(`${task} forex macro drivers`);
    queries.add(`${task} central bank expectations`);
    queries.add(`${task} currency strength risk events`);
  }

  if (/(wealth|prosperity|accumulate|capital|compound|allocation|portfolio)/.test(lower)) {
    queries.add(`${task} capital allocation framework`);
    queries.add(`${task} fastest ethical accumulation paths`);
    queries.add(`${task} risk-adjusted wealth strategy`);
  }

  queries.add(`${task} latest market context`);
  return Array.from(queries).slice(0, 5);
}

function capabilityLabel(capability: string) {
  switch (capability) {
    case "crypto-web3":
      return "crypto & web3";
    case "forex":
      return "forex";
    case "trading":
      return "trading strategy";
    case "wealth":
      return "wealth building";
    default:
      return capability;
  }
}

export class FinanceAgent {
  private static skill: string | null = null;

  static async loadSkill(): Promise<string> {
    if (this.skill) return this.skill;
    try {
      this.skill = await fs.readFile(SKILL_PATH, "utf-8");
    } catch {
      this.skill =
        "Finance Agent: Help with trading, crypto/web3, forex, macro context, capital preservation, and wealth-building plans. Be practical, risk-aware, and action-oriented without pretending to execute trades.";
    }
    return this.skill;
  }

  static async process(request: FinanceAgentRequest): Promise<FinanceAgentResponse> {
    const skill = await this.loadSkill();
    const capabilities = detectCapabilities(request.task);
    const scope = capabilities.length > 0 ? capabilities : ["trading", "wealth"];
    const approval = needsApproval(request.task);
    const expandedQueries = expandFinanceQueries(request.task);
    const searchResponses = await Promise.all(expandedQueries.map((query) => webSearch(query, 4)));
    const searchBlock = searchResponses.map((response) => formatResultsForPrompt(response)).join("\n\n");
    const priorResearch = await querySimilarResearch(request.task, 3);
    const priorBlock = priorResearch ? `\n\n## Shared Blackboard Retrieval\n${priorResearch}` : "";

    const systemPrompt = `${skill}

You are ZED's Finance Agent.

Coverage:
- crypto and web3 market reasoning
- forex market structure and trade framing
- trading plans, risk management, and scenario planning
- wealth prosperity, capital growth, and allocation thinking

Rules:
- Never claim a trade was placed, funds were moved, or any market action actually executed.
- If the request sounds like direct execution, return a proposal, trade plan, or risk-managed recommendation instead.
- If live market pricing is not provided, be transparent that the response is a reasoning framework rather than a guaranteed live quote.
- Optimize for predictive analysis and the fastest realistic accumulation path based on the user's current circumstances and market conditions.
- Prefer outputs with: thesis, current conditions, predictive drivers, scenario map, setup, risk, invalidation, and next step.
- If enough context exists, convert broad ambition into a concrete accumulation path with timelines, prerequisites, and tradeoffs.
- Use the same shared blackboard mindset as Intelligence: pull from shared memory, prior research, and live search context before answering.

Active focus lanes: ${scope.map(capabilityLabel).join(", ")}.
${request.memoryContext ? `\nShared knowledge context:\n${request.memoryContext}` : ""}${priorBlock}

## Live Market / Research Context
${searchBlock}

Return a direct operator-style response. Avoid vague motivation language.`.trim();

    const reply = await generateChatFromOllama([{ role: "user", content: request.task }], systemPrompt, {
      lane: "finance",
    });
    await storeResearchBrief({
      topic: `FinanceAgent: ${request.task}`,
      date: new Date().toISOString(),
      confidence: searchResponses.some((response) => response.source !== "none") ? "medium" : "low",
      keyFindings: reply
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 4),
      implications: `Finance lane analysis for ${request.task}`,
      recommendedAction: "Review the proposed accumulation or trading path and validate against live execution constraints.",
    }).catch(() => {});
    await this.writeToMemory(request, reply, scope, approval);
    await this.log(request, reply, scope, approval);

    return {
      agent: "FinanceAgent",
      capabilities: scope.map(capabilityLabel),
      requiresApproval: approval,
      message: approval
        ? `${reply}\n\nAdministrative approval is recommended before treating this as an execution-ready capital movement or live trade action.`
        : reply,
    };
  }

  private static async writeToMemory(
    request: FinanceAgentRequest,
    reply: string,
    capabilities: string[],
    requiresApproval: boolean,
  ) {
    try {
      const entry = `\n## [${new Date().toISOString()}] Finance Agent\n**User**: ${request.userId}\n**Capabilities**: ${capabilities.map(capabilityLabel).join(", ")}\n**Approval**: ${requiresApproval ? "recommended" : "not required"}\n**Request**: ${request.task}\n**Response**: ${reply.slice(0, 320)}...\n`;
      await fs.appendFile(FINANCE_MEMORY_PATH, entry);
    } catch {}
  }

  private static async log(
    request: FinanceAgentRequest,
    reply: string,
    capabilities: string[],
    requiresApproval: boolean,
  ) {
    try {
      await fs.mkdir(FINANCE_LOG_DIR, { recursive: true });
      const logPath = path.join(FINANCE_LOG_DIR, `${new Date().toISOString().split("T")[0]}.log`);
      const line =
        JSON.stringify({
          timestamp: new Date().toISOString(),
          userId: request.userId,
          conversationId: request.conversationId,
          task: request.task,
          replyLength: reply.length,
          capabilities,
          requiresApproval,
        }) + "\n";
      await fs.appendFile(logPath, line);
    } catch {}
  }
}
