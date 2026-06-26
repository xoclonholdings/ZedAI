import fs from "fs/promises";
import path from "path";
import { generateChatFromOllama } from "../../services/Ollama/OllamaService";
import { formatResultsForPrompt, webSearch } from "../../services/WebSearchService";
import { querySimilarResearch, storeResearchBrief } from "../../services/ChromaService";
import { AgentApprovalAdapter } from "../../services/approval/AgentApprovalAdapter";
import { buildTradingKnowledgeContext } from "../../zcos/trading/TradingKnowledgeBase";
import { TradingStore } from "../../zcos/trading/TradingStore";
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
  if (/(equity|equities|stock|stocks|etf|etfs|spy|qqq|iwm|sector fund)/.test(lower)) {
    capabilities.add("equities-etfs");
  }
  if (/(future|futures|es|nq|ym|rty|cl|gc|micro e-mini|contract)/.test(lower)) {
    capabilities.add("futures");
  }
  if (/(trade|trading|entry|exit|stop loss|take profit|position|setup|chart|price action|portfolio|paper trade|journal|backtest|strategy|risk)/.test(lower)) {
    capabilities.add("trading-intelligence");
  }
  if (/(wealth|prosperity|capital|compound|allocation|risk|cashflow|returns|net worth)/.test(lower)) {
    capabilities.add("capital-risk");
  }

  return [...capabilities];
}

function needsApproval(task: string) {
  const lower = task.toLowerCase();
  if (/(paper trade|paper trading|simulated|simulation|journal|backtest|back test|trade thesis|trade plan)/.test(lower)) {
    return false;
  }
  return /(buy|sell|short|long|open position|close position|rebalance|allocate|move funds|wire|swap|place order|execute trade)/i.test(task);
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

  if (/(equity|equities|stock|stocks|etf|etfs|spy|qqq|iwm)/.test(lower)) {
    queries.add(`${task} equity market structure breadth volatility`);
    queries.add(`${task} ETF sector rotation liquidity catalysts`);
  }

  if (/(future|futures|es|nq|ym|rty|cl|gc|micro e-mini|contract)/.test(lower)) {
    queries.add(`${task} futures session structure liquidity volatility`);
    queries.add(`${task} futures economic calendar news risk`);
  }

  if (/(wealth|prosperity|accumulate|capital|compound|allocation|portfolio)/.test(lower)) {
    queries.add(`${task} capital allocation risk management framework`);
    queries.add(`${task} risk-adjusted portfolio drawdown controls`);
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
    case "equities-etfs":
      return "equities & ETFs";
    case "futures":
      return "futures";
    case "trading-intelligence":
      return "trading intelligence";
    case "capital-risk":
      return "capital and risk management";
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
        "ZED Trading Intelligence Analyst: Help with equities, ETFs, futures, forex, crypto, market structure, paper-trading validation, risk controls, and performance review. Be evidence-driven, risk-aware, and clear that no live trades are executed.";
    }
    return this.skill;
  }

  static async process(request: FinanceAgentRequest): Promise<FinanceAgentResponse> {
    const skill = await this.loadSkill();
    const capabilities = detectCapabilities(request.task);
    const scope = capabilities.length > 0 ? capabilities : ["trading-intelligence", "capital-risk"];
    const approval = needsApproval(request.task);
    const expandedQueries = expandFinanceQueries(request.task);
    const searchResponses = await Promise.all(expandedQueries.map((query) => webSearch(query, 4)));
    const searchBlock = searchResponses.map((response) => formatResultsForPrompt(response)).join("\n\n");
    const priorResearch = await querySimilarResearch(request.task, 3);
    const priorBlock = priorResearch ? `\n\n## Shared Blackboard Retrieval\n${priorResearch}` : "";
    const tradingKnowledge = await buildTradingKnowledgeContext(request.task).catch(
      () => "Trading knowledge context unavailable.",
    );
    const tradingPerformance = await TradingStore.getPerformance(request.userId).catch(() => null);
    const performanceBlock = tradingPerformance
      ? [
          `Paper trades: ${tradingPerformance.closedTrades} closed, ${tradingPerformance.openTrades} open`,
          `Win rate: ${(tradingPerformance.winRate * 100).toFixed(1)}%`,
          `Expectancy: ${tradingPerformance.expectancy}`,
          `Profit factor: ${tradingPerformance.profitFactor}`,
          `Max drawdown: ${tradingPerformance.maximumDrawdown}`,
        ].join("\n")
      : "No paper-trading performance report available yet.";

    const systemPrompt = `${skill}

You are ZED's Trading Intelligence Analyst.

Coverage:
- equities and ETFs analysis
- futures market structure and session context
- forex market structure and macro drivers
- cryptocurrency and web3 market reasoning
- trading plans, strategy validation, risk management, and scenario planning
- portfolio exposure, correlation risk, and capital preservation analysis

Operating Standard:
- Research first, simulate second, validate third, and only consider live deployment after all validation requirements are met.
- Treat every trade as analysis or paper trading unless a future approved broker integration exists.
- Do not claim a live trade was placed, funds were moved, or an order was transmitted.
- No real-money execution exists in Phase 1.
- Use stored trading knowledge, TradingView snapshots, scanner output, paper-trading history, and journal lessons when relevant.
- No setup is valid without market structure, liquidity analysis, entry, stop, target, risk/reward, and invalidation.
- If the user asks for live execution, convert it into a trade thesis, paper-trade plan, or approval-gated future action.
- If the user asks to log a paper trade, require market, asset class, symbol, direction, entry, stop, target, size, risk amount, and entry reason.

Rules:
- Never provide financial advice or encourage speculative trading.
- Never claim a trade was placed, funds were moved, or any market action actually executed.
- If the request sounds like direct execution, return a trade thesis, paper-trade plan, or risk review instead.
- If live market pricing is not provided, state that the response is a reasoning framework rather than a live quote.
- If economic calendar, news, historical performance, journal, or pricing data is unavailable, identify the missing inputs before concluding.
- Optimize for positive expectancy, controlled drawdowns, consistent execution, repeatable process, and long-term survivability.
- Prefer outputs with: thesis, market context, statistical edge, entry validation, exit validation, risk analysis, failure analysis, optimization opportunities, confidence assessment, invalidation, and next step.
- Use the same shared blackboard mindset as Intelligence: pull from shared memory, prior research, trading knowledge, paper-trading history, and live search context before answering.

Active focus lanes: ${scope.map(capabilityLabel).join(", ")}.
${request.memoryContext ? `\nShared knowledge context:\n${request.memoryContext}` : ""}${priorBlock}

## Trading Knowledge Context
${tradingKnowledge}

## Paper Trading Performance Context
${performanceBlock}

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
      implications: `Trading intelligence analysis for ${request.task}`,
      recommendedAction: "Review the proposed thesis, risk controls, and validation requirements before treating any setup as execution-ready.",
    }).catch(() => {});
    await this.writeToMemory(request, reply, scope, approval);
    await this.log(request, reply, scope, approval);

    let approvalSuffix = "";
    if (approval) {
      try {
        const registered = await AgentApprovalAdapter.register({
          user_id: request.userId,
          conversation_id: request.conversationId || null,
          message: request.task,
          draft: reply,
          agent: "FinanceAgent",
          capabilities: scope.map(capabilityLabel),
        });
        approvalSuffix = `\n\nLogged as task ${registered.task_id} (${registered.approval_status}). Admin will review before any capital movement or trade action.`;
      } catch (err) {
        console.warn("[FinanceAgent] Approval registration failed:", err);
        approvalSuffix = "\n\nAdministrative approval is recommended before treating this as an execution-ready capital movement or live trade action.";
      }
    }

    return {
      agent: "FinanceAgent",
      capabilities: scope.map(capabilityLabel),
      requiresApproval: approval,
      message: approval ? `${reply}${approvalSuffix}` : reply,
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
