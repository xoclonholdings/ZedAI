import fs from "fs/promises";
import path from "path";
import { generateChatFromProvider } from "../../services/ModelProviderService";
import type { ImageBlock, ReasoningEffort } from "../../core/providers/provider-interface";
import { formatResultsForPrompt, webSearch } from "../../services/WebSearchService";
import { querySimilarResearch, storeResearchBrief } from "../../services/ChromaService";
import { AgentApprovalAdapter } from "../../services/approval/AgentApprovalAdapter";
import { buildTradingKnowledgeContext } from "../../zcos/trading/TradingKnowledgeBase";
import { TradingStore } from "../../zcos/trading/TradingStore";
import { BudgetStore } from "../../services/budget/BudgetStore";
import {
  allocateDeposit,
  buildDepositRecommendation,
  evaluateTreasuryReadiness,
  type IncomeSource,
} from "../../../shared/budget-types";
import { HUB_LOG_DIR, HUB_SHARED_MEMORY_DIR, REPO_ROOT } from "../../utils/repoPaths";

const SKILL_PATH = path.resolve(REPO_ROOT, "server/agents/finance/SKILL.md");
const FINANCE_LOG_DIR = path.resolve(HUB_LOG_DIR, "finance");
const FINANCE_MEMORY_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "working/current-tasks.md");

export interface FinanceAgentRequest {
  userId: string;
  task: string;
  conversationId?: string;
  memoryContext?: string;
  attachments?: ImageBlock[];
  reasoningEffort?: ReasoningEffort;
}

export interface FinanceAgentResponse {
  agent: "FinanceAgent";
  message: string;
  requiresApproval?: boolean;
  capabilities: string[];
  tradingAction?: "log_paper_trade" | "missing_paper_trade_fields" | "show_journal" | "analyze_setup";
  recordId?: string;
  missingFields?: string[];
}

function isStructuralAudit(task: string) {
  return /(4-pillar|four pillar|structural audit|setup audit|system audit|technical patch|technical patches|binary logical trigger|math\/risk|systemic weakness)/i.test(
    task,
  );
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
  if (/(audit|structural|pillar|trigger|patch|failure mode|weakness|expectancy|risk-to-reward|system)/.test(lower)) {
    capabilities.add("trading-intelligence");
  }
  if (/(wealth|prosperity|capital|compound|allocation|risk|cashflow|returns|net worth)/.test(lower)) {
    capabilities.add("capital-risk");
  }

  return [...capabilities];
}

function needsApproval(task: string) {
  const lower = task.toLowerCase();
  if (/(paper trade|paper trading|simulated|simulation|journal|backtest|back test|trade thesis|trade plan|audit|review)/.test(lower)) {
    return false;
  }
  return /(buy|sell|short|long|open position|close position|rebalance|allocate|move funds|wire|swap|place order|execute trade)/i.test(task);
}

function expandFinanceQueries(task: string): string[] {
  const lower = task.toLowerCase();
  const queries = new Set<string>([task]);

  if (isStructuralAudit(task)) {
    queries.add(`${task} market regime volatility liquidity risk controls`);
    queries.add(`${task} trading system audit binary triggers expectancy drawdown`);
  }

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

function parseNumberAfter(task: string, label: string): number | undefined {
  const match = task.match(new RegExp(`\\b${label}\\s+(-?\\d+(?:\\.\\d+)?)`, "i"));
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function parsePaperTrade(task: string) {
  if (!/\blog (a )?paper trade\b|\bpaper trade\b/i.test(task)) return null;
  const symbol = task.match(/\b([A-Z]{1,6})(?:\s+(long|short)\b|\b)/)?.[1]?.toUpperCase();
  const direction = task.match(/\b(long|short)\b/i)?.[1]?.toLowerCase() as "long" | "short" | undefined;
  const entry = parseNumberAfter(task, "entry");
  const stop = parseNumberAfter(task, "stop");
  const target = parseNumberAfter(task, "target");
  const thesis = task.match(/\b(?:thesis|reason)\s+(.+)$/i)?.[1]?.trim();
  const missingFields = [
    !symbol ? "symbol" : "",
    !direction ? "direction" : "",
    entry === undefined ? "entry" : "",
    stop === undefined ? "stop" : "",
    target === undefined ? "target" : "",
    !thesis ? "entryReason" : "",
  ].filter(Boolean);
  return { symbol, direction, entry, stop, target, thesis, missingFields };
}

function parseDepositAmount(task: string): number | undefined {
  const match = task.match(/\$\s?(\d[\d,]*(?:\.\d+)?)|\b(\d[\d,]*(?:\.\d+)?)\s*(?:dollars|bucks|deposit|paycheck|payout)\b/i);
  const raw = match?.[1] || match?.[2];
  if (!raw) return undefined;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function detectIncomeSource(task: string): IncomeSource {
  const lower = task.toLowerCase();
  if (/doordash|door dash|dd/.test(lower)) return "doordash";
  if (/instacart|insta cart/.test(lower)) return "instacart";
  if (/employer|paycheck|salary|w-?2|direct deposit/.test(lower)) return "employer";
  return "manual";
}

/**
 * Detect a Budget Management (Dual Reserve) allocation request. Kept
 * specific so it does not hijack trading capital-allocation questions:
 * requires an amount plus deposit/budget/payroll/gig language.
 */
function parseBudgetIntent(task: string): { amount: number; source: IncomeSource } | null {
  const lower = task.toLowerCase();
  const budgetLanguage =
    /(budget|deposit|paycheck|direct deposit|payout|doordash|instacart|dual reserve|personal payroll|founder pay|tax reserve|treasury allocation|allocate .*deposit|split .*(deposit|paycheck|income))/.test(
      lower,
    );
  if (!budgetLanguage) return null;
  const tradingLanguage = /(paper trade|thesis|entry|stop|target|long|short|position|chart|setup)/.test(lower);
  if (tradingLanguage) return null;
  const amount = parseDepositAmount(task);
  if (amount === undefined) return null;
  return { amount, source: detectIncomeSource(task) };
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
        "ZAR Finance Agent, current Trading Intelligence phase: Help with trading, crypto/web3, forex, equities, ETFs, futures, capital allocation, wealth-building analysis, paper-trading validation, risk controls, and performance review. Be evidence-driven, risk-aware, and clear that no live trades are executed.";
    }
    return this.skill;
  }

  static async process(request: FinanceAgentRequest): Promise<FinanceAgentResponse> {
    const skill = await this.loadSkill();

    const budgetIntent = parseBudgetIntent(request.task);
    if (budgetIntent) {
      const state = await BudgetStore.loadState(request.userId);
      const breakdown = allocateDeposit(budgetIntent.amount, state.rule);
      const readiness = evaluateTreasuryReadiness(
        state.balances.treasuryBalance,
        state.targets.operatingReserveTarget,
      );
      const recommendation = buildDepositRecommendation({
        amount: budgetIntent.amount,
        breakdown,
        readiness,
        settings: state.settings,
      });
      await BudgetStore.appendMemory(
        `Chat deposit allocation (${budgetIntent.source}): ${breakdown.total} -> savings ${breakdown.savings}, taxes ${breakdown.taxes}, payroll ${breakdown.payroll}, treasury ${breakdown.treasury}.`,
      );
      return {
        agent: "FinanceAgent",
        capabilities: ["budget management", "capital and risk management"],
        requiresApproval: false,
        message: `${recommendation}\n\nNothing was moved — this is your allocation plan. Open Budget Management to record the deposit and update your reserves.`,
      };
    }

    const paperTrade = parsePaperTrade(request.task);
    if (paperTrade) {
      const capabilities = ["trading intelligence"];
      if (paperTrade.missingFields.length > 0) {
        return {
          agent: "FinanceAgent",
          capabilities,
          requiresApproval: false,
          tradingAction: "missing_paper_trade_fields",
          missingFields: paperTrade.missingFields,
          message: `I can log that paper trade after these fields are supplied: ${paperTrade.missingFields.join(", ")}.`,
        };
      }
      const record = await TradingStore.openPaperTrade({
        userId: request.userId,
        market: "US",
        assetClass: "stock",
        symbol: paperTrade.symbol!,
        direction: paperTrade.direction!,
        entry: paperTrade.entry!,
        stop: paperTrade.stop!,
        target: paperTrade.target!,
        size: 1,
        riskAmount: Math.abs(paperTrade.entry! - paperTrade.stop!),
        entryReason: paperTrade.thesis!,
        screenshots: [],
        lessonsLearned: [],
        ruleViolations: [],
      });
      return {
        agent: "FinanceAgent",
        capabilities,
        requiresApproval: false,
        tradingAction: "log_paper_trade",
        recordId: record.id,
        message: `Paper trade logged: ${record.symbol} ${record.direction} entry ${record.entry}, stop ${record.stop}, target ${record.target}. Record ID: ${record.id}.`,
      };
    }

    const auditMode = isStructuralAudit(request.task);
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

    const auditInstructions = auditMode
      ? `\n\nFour-Pillar Structural Audit Mode is active. Use exactly these sections when answering:\n1. Market Context\n2. Binary Logical Triggers\n3. Math/Risk Metrics\n4. Systemic Weaknesses\n5. Technical Patches\n\nFor each pillar, label available facts, assumptions, missing data, and decision status. For Technical Patches, include issue, proposed change, expected benefit, potential downside, validation plan, and priority. If the user did not provide a concrete trade setup, audit the currently available setup or configuration and state that live-market conclusions are non-assessable without symbol, timeframe, entry, stop, target, current price, session, and account-risk inputs.`
      : "";

    const systemPrompt = `${skill}

You are ZAR's Finance Agent operating in the current Trading Intelligence Analyst phase.

Preserve the broader FinanceAgent end-state from SPEC.md: trading, crypto/web3, forex, market opportunity, accumulation strategy, wealth-building, and capital allocation analysis. In this phase, express those objectives through disciplined research, paper trading, strategy validation, risk controls, and performance analytics.

Coverage:
- equities and ETFs analysis
- futures market structure and session context
- forex market structure and macro drivers
- cryptocurrency and web3 market reasoning
- trading plans, strategy validation, risk management, and scenario planning
- wealth-building and accumulation strategy review as risk-managed planning, not speculative encouragement
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
- If the request sounds like direct execution, return a trade thesis, paper-trade plan, capital allocation framework, or risk review instead.
- If live market pricing is not provided, state that the response is a reasoning framework rather than a live quote.
- If economic calendar, news, historical performance, journal, or pricing data is unavailable, identify the missing inputs before concluding.
- Optimize for positive expectancy, controlled drawdowns, consistent execution, repeatable process, risk-adjusted capital growth, and long-term survivability.
- Prefer outputs with: thesis, market context, statistical edge, entry validation, exit validation, risk analysis, failure analysis, optimization opportunities, confidence assessment, invalidation, and next step.
- Use the same shared blackboard mindset as Intelligence: pull from shared memory, prior research, trading knowledge, paper-trading history, and live search context before answering.${auditInstructions}

Active focus lanes: ${scope.map(capabilityLabel).join(", ")}.
${request.memoryContext ? `\nShared knowledge context:\n${request.memoryContext}` : ""}${priorBlock}

## Trading Knowledge Context
${tradingKnowledge}

## Paper Trading Performance Context
${performanceBlock}

## Live Market / Research Context
${searchBlock}

Return a direct operator-style response. Avoid vague motivation language.`.trim();

    const reply = await generateChatFromProvider([{ role: "user", content: request.task }], systemPrompt, {
      lane: "finance",
      attachments: request.attachments,
      reasoningEffort: request.reasoningEffort,
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
      implications: auditMode ? `Four-pillar trading audit for ${request.task}` : `Finance lane analysis for ${request.task}`,
      recommendedAction: auditMode
        ? "Review the technical patches and validate them through paper-trading metrics before changing live behavior."
        : "Review the proposed thesis, capital framework, risk controls, and validation requirements before treating any setup as execution-ready.",
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
