import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { HUB_DIR, HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import type {
  PaperTrade,
  PaperTradeStatus,
  TradeReviewReport,
  TradeThesis,
  TradingGovernanceDecision,
  TradingIncidentReport,
  TradingKnowledgeEntry,
  TradingPatternAnalytics,
  TradingPerformanceReport,
  TradingViewRecord,
} from "../../../shared/trading-types";

const TRADING_DIR = path.resolve(HUB_DIR, "trading");
const KNOWLEDGE_PATH = path.resolve(TRADING_DIR, "knowledge.json");
const THESES_PATH = path.resolve(TRADING_DIR, "trade-theses.json");
const PAPER_TRADES_PATH = path.resolve(TRADING_DIR, "paper-trades.json");
const TRADINGVIEW_PATH = path.resolve(TRADING_DIR, "tradingview-records.json");
const GOVERNANCE_DECISIONS_PATH = path.resolve(TRADING_DIR, "governance-decisions.json");
const INCIDENT_REPORTS_PATH = path.resolve(TRADING_DIR, "incident-reports.json");
const TRADING_MEMORY_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "working", "trading-intelligence.md");

async function ensureTradingDirs() {
  await fs.mkdir(TRADING_DIR, { recursive: true });
  await fs.mkdir(path.dirname(TRADING_MEMORY_PATH), { recursive: true });
}

async function readJsonArray<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonArray<T>(file: string, data: T[]) {
  await ensureTradingDirs();
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

function now() {
  return new Date().toISOString();
}

function calculateRealizedPnl(trade: PaperTrade, exitPrice: number): number {
  const raw = trade.direction === "long" ? exitPrice - trade.entry : trade.entry - exitPrice;
  return Number((raw * trade.size).toFixed(4));
}

function classifyOutcome(pnl: number): PaperTrade["outcome"] {
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  return "breakeven";
}

function longestRun(outcomes: Array<PaperTrade["outcome"]>, target: PaperTrade["outcome"]): number {
  let current = 0;
  let best = 0;
  for (const outcome of outcomes) {
    if (outcome === target) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function calculateMaxDrawdown(closedTrades: PaperTrade[]): number {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const trade of closedTrades) {
    equity += trade.realizedPnl || 0;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }

  return Number(maxDrawdown.toFixed(4));
}

function calculateProfitFactor(grossWins: number, grossLosses: number): number {
  if (grossLosses > 0) return Number((grossWins / grossLosses).toFixed(4));
  if (grossWins > 0) return 999999;
  return 0;
}

function setupNameFor(trade: PaperTrade, thesis?: TradeThesis): string {
  return (
    trade.setupName ||
    thesis?.status ||
    thesis?.reason?.slice(0, 48) ||
    `${trade.symbol} ${trade.direction}`
  );
}

function increment(map: Map<string, { count: number; wins: number; pnl: number }>, key: string, trade: PaperTrade) {
  const existing = map.get(key) || { count: 0, wins: 0, pnl: 0 };
  existing.count += 1;
  existing.wins += trade.outcome === "win" ? 1 : 0;
  existing.pnl += trade.realizedPnl || 0;
  map.set(key, existing);
}

function rankedByWinRate(map: Map<string, { count: number; wins: number; pnl: number }>, direction: "best" | "worst") {
  return Array.from(map.entries())
    .filter(([, stats]) => stats.count > 0)
    .sort((a, b) => {
      const ar = a[1].wins / a[1].count;
      const br = b[1].wins / b[1].count;
      return direction === "best" ? br - ar || b[1].pnl - a[1].pnl : ar - br || a[1].pnl - b[1].pnl;
    })
    .slice(0, 5)
    .map(([key, stats]) => `${key} (${stats.wins}/${stats.count}, P&L ${Number(stats.pnl.toFixed(2))})`);
}

function mostCommon(items: string[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const item of items.map((value) => value.trim()).filter(Boolean)) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([item, count]) => `${item} (${count})`);
}

function buildPatternAnalytics(closedTrades: PaperTrade[], theses: TradeThesis[]): TradingPatternAnalytics {
  const thesisById = new Map(theses.map((thesis) => [thesis.id, thesis]));
  const setupStats = new Map<string, { count: number; wins: number; pnl: number }>();
  const assetStats = new Map<string, { count: number; wins: number; pnl: number }>();
  const timeframeStats = new Map<string, { count: number; wins: number; pnl: number }>();

  const mistakes: string[] = [];
  const ruleViolations: string[] = [];

  for (const trade of closedTrades) {
    const thesis = trade.thesisId ? thesisById.get(trade.thesisId) : undefined;
    increment(setupStats, setupNameFor(trade, thesis), trade);
    increment(assetStats, trade.assetClass, trade);
    increment(timeframeStats, trade.timeframe || thesis?.primaryTimeframe || "unspecified", trade);
    mistakes.push(...trade.lessonsLearned);
    ruleViolations.push(...trade.ruleViolations);
  }

  return {
    highestWinRateSetups: rankedByWinRate(setupStats, "best"),
    lowestWinRateSetups: rankedByWinRate(setupStats, "worst"),
    mostProfitableConditions: Array.from(setupStats.entries())
      .sort((a, b) => b[1].pnl - a[1].pnl)
      .slice(0, 5)
      .map(([key, stats]) => `${key} (P&L ${Number(stats.pnl.toFixed(2))})`),
    mostCommonMistakes: mostCommon(mistakes),
    mostCommonRuleViolations: mostCommon(ruleViolations),
    bestAssetClasses: rankedByWinRate(assetStats, "best"),
    worstAssetClasses: rankedByWinRate(assetStats, "worst"),
    bestTimeframes: rankedByWinRate(timeframeStats, "best"),
    worstTimeframes: rankedByWinRate(timeframeStats, "worst"),
  };
}

function createReviewReport(trade: PaperTrade, thesis?: TradeThesis): TradeReviewReport {
  const outcome = trade.outcome || "breakeven";
  const violationCount = trade.ruleViolations.length;
  const executionQuality =
    outcome === "win" && violationCount === 0
      ? "excellent"
      : violationCount === 0
        ? "good"
        : violationCount <= 2
          ? "needs_work"
          : "poor";
  const ruleCompliance = violationCount === 0 ? "clean" : violationCount <= 2 ? "minor_violations" : "major_violations";

  const recommendedImprovements = [
    violationCount > 0 ? "Review the rule violations before taking the next setup." : "Keep the same rule discipline on the next setup.",
    trade.lessonsLearned.length > 0
      ? "Convert lessons learned into pre-entry checklist items."
      : "Add at least one lesson before archiving the trade review.",
    thesis ? "Compare the final result against the original thesis and invalidation conditions." : "Attach future paper trades to a thesis for cleaner review quality.",
  ];

  return {
    id: randomUUID(),
    tradeId: trade.id,
    thesisId: trade.thesisId,
    createdAt: now(),
    originalThesis: thesis
      ? `${thesis.symbol} ${thesis.direction}: ${thesis.reason}`
      : `${trade.symbol} ${trade.direction}: ${trade.entryReason}`,
    outcome,
    executionQuality,
    ruleCompliance,
    mistakes: trade.ruleViolations,
    lessonsLearned: trade.lessonsLearned,
    recommendedImprovements,
  };
}

export const TradingStore = {
  async listKnowledge(): Promise<TradingKnowledgeEntry[]> {
    await ensureTradingDirs();
    const entries = await readJsonArray<TradingKnowledgeEntry>(KNOWLEDGE_PATH);
    return entries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  async addKnowledge(input: Omit<TradingKnowledgeEntry, "id" | "createdAt" | "updatedAt">): Promise<TradingKnowledgeEntry> {
    const entries = await this.listKnowledge();
    const timestamp = now();
    const entry: TradingKnowledgeEntry = {
      ...input,
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await writeJsonArray(KNOWLEDGE_PATH, [entry, ...entries]);
    await this.appendMemory(`Knowledge added: ${entry.title} (${entry.category}) from ${entry.source}.`);
    return entry;
  },

  async searchKnowledge(query: string, limit = 6): Promise<TradingKnowledgeEntry[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const entries = await this.listKnowledge();
    return entries
      .map((entry) => {
        const haystack = [
          entry.title,
          entry.source,
          entry.category,
          ...entry.concepts,
          ...entry.definitions,
          ...entry.rules,
          ...entry.patterns,
          ...entry.entryCriteria,
          ...entry.exitCriteria,
          ...entry.riskRules,
          ...entry.examples,
          ...entry.mistakes,
          ...entry.bestPractices,
          ...entry.tags,
        ]
          .join(" ")
          .toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { entry, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.entry);
  },

  async listTheses(userId?: string): Promise<TradeThesis[]> {
    await ensureTradingDirs();
    const theses = await readJsonArray<TradeThesis>(THESES_PATH);
    return theses
      .filter((thesis) => !userId || thesis.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async addThesis(input: Omit<TradeThesis, "id" | "createdAt">): Promise<TradeThesis> {
    const theses = await readJsonArray<TradeThesis>(THESES_PATH);
    const thesis: TradeThesis = {
      ...input,
      id: randomUUID(),
      createdAt: now(),
    };
    await writeJsonArray(THESES_PATH, [thesis, ...theses]);
    await this.appendMemory(`Trade thesis created: ${thesis.symbol} ${thesis.direction} (${thesis.status}).`);
    return thesis;
  },

  async updateThesis(input: { id: string; userId: string; patch: Partial<TradeThesis> }): Promise<TradeThesis | null> {
    const theses = await readJsonArray<TradeThesis>(THESES_PATH);
    const index = theses.findIndex((thesis) => thesis.id === input.id && thesis.userId === input.userId);
    if (index === -1) return null;
    const updated: TradeThesis = { ...theses[index], ...input.patch, id: theses[index].id, userId: theses[index].userId };
    theses[index] = updated;
    await writeJsonArray(THESES_PATH, theses);
    await this.appendMemory(`Trade thesis updated: ${updated.symbol} ${updated.direction} (${updated.status}).`);
    return updated;
  },

  async archiveThesis(input: { id: string; userId: string }): Promise<TradeThesis | null> {
    return this.updateThesis({ id: input.id, userId: input.userId, patch: { archivedAt: now() } });
  },

  async listPaperTrades(userId?: string, status?: PaperTradeStatus): Promise<PaperTrade[]> {
    await ensureTradingDirs();
    const trades = await readJsonArray<PaperTrade>(PAPER_TRADES_PATH);
    return trades
      .filter((trade) => !userId || trade.userId === userId)
      .filter((trade) => !status || trade.status === status)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async openPaperTrade(input: Omit<PaperTrade, "id" | "createdAt" | "updatedAt" | "status">): Promise<PaperTrade> {
    const trades = await readJsonArray<PaperTrade>(PAPER_TRADES_PATH);
    const timestamp = now();
    const trade: PaperTrade = {
      ...input,
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
      status: "open",
      screenshots: input.screenshots || [],
      lessonsLearned: input.lessonsLearned || [],
      ruleViolations: input.ruleViolations || [],
    };
    await writeJsonArray(PAPER_TRADES_PATH, [trade, ...trades]);
    await this.appendMemory(`Paper trade opened: ${trade.symbol} ${trade.direction} entry ${trade.entry}, stop ${trade.stop}, target ${trade.target}. Authorization: ${trade.authorizationDecision || "not recorded"}.`);
    return trade;
  },

  async closePaperTrade(input: {
    id: string;
    userId: string;
    exitPrice: number;
    exitReason?: string;
    lessonsLearned?: string[];
    ruleViolations?: string[];
  }): Promise<PaperTrade | null> {
    const trades = await readJsonArray<PaperTrade>(PAPER_TRADES_PATH);
    const theses = await readJsonArray<TradeThesis>(THESES_PATH);
    const index = trades.findIndex((trade) => trade.id === input.id && trade.userId === input.userId);
    if (index === -1) return null;

    const existing = trades[index];
    if (existing.status !== "open") return existing;

    const realizedPnl = calculateRealizedPnl(existing, input.exitPrice);
    const baseUpdated: PaperTrade = {
      ...existing,
      status: "closed",
      updatedAt: now(),
      closedAt: now(),
      exitPrice: input.exitPrice,
      realizedPnl,
      outcome: classifyOutcome(realizedPnl),
      exitReason: input.exitReason || existing.exitReason,
      lessonsLearned: [...existing.lessonsLearned, ...(input.lessonsLearned || [])],
      ruleViolations: [...existing.ruleViolations, ...(input.ruleViolations || [])],
    };
    const thesis = baseUpdated.thesisId ? theses.find((item) => item.id === baseUpdated.thesisId) : undefined;
    const updated: PaperTrade = {
      ...baseUpdated,
      reviewReport: createReviewReport(baseUpdated, thesis),
    };

    trades[index] = updated;
    await writeJsonArray(PAPER_TRADES_PATH, trades);
    await this.appendMemory(`Paper trade closed: ${updated.symbol} ${updated.direction} exit ${input.exitPrice}, P&L ${realizedPnl}. Review: ${updated.reviewReport?.executionQuality}, compliance ${updated.reviewReport?.ruleCompliance}.`);
    return updated;
  },

  async listTradingViewRecords(userId?: string): Promise<TradingViewRecord[]> {
    await ensureTradingDirs();
    const records = await readJsonArray<TradingViewRecord>(TRADINGVIEW_PATH);
    return records
      .filter((record) => !userId || record.userId === userId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  async addTradingViewRecord(input: Omit<TradingViewRecord, "id" | "createdAt" | "updatedAt">): Promise<TradingViewRecord> {
    const records = await readJsonArray<TradingViewRecord>(TRADINGVIEW_PATH);
    const timestamp = now();
    const record: TradingViewRecord = {
      ...input,
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await writeJsonArray(TRADINGVIEW_PATH, [record, ...records]);
    await this.appendMemory(`TradingView ${record.type} added: ${record.symbol} ${record.title}.`);
    return record;
  },

  async updateTradingViewRecord(input: { id: string; userId: string; patch: Partial<TradingViewRecord> }): Promise<TradingViewRecord | null> {
    const records = await readJsonArray<TradingViewRecord>(TRADINGVIEW_PATH);
    const index = records.findIndex((record) => record.id === input.id && record.userId === input.userId);
    if (index === -1) return null;
    const updated: TradingViewRecord = {
      ...records[index],
      ...input.patch,
      id: records[index].id,
      userId: records[index].userId,
      updatedAt: now(),
    };
    records[index] = updated;
    await writeJsonArray(TRADINGVIEW_PATH, records);
    await this.appendMemory(`TradingView ${updated.type} updated: ${updated.symbol} ${updated.title}.`);
    return updated;
  },

  async listGovernanceDecisions(userId?: string): Promise<TradingGovernanceDecision[]> {
    await ensureTradingDirs();
    const decisions = await readJsonArray<TradingGovernanceDecision>(GOVERNANCE_DECISIONS_PATH);
    return decisions
      .filter((decision) => !userId || decision.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async addGovernanceDecision(input: Omit<TradingGovernanceDecision, "id" | "createdAt" | "version" | "reviewer">): Promise<TradingGovernanceDecision> {
    const decisions = await readJsonArray<TradingGovernanceDecision>(GOVERNANCE_DECISIONS_PATH);
    const decision: TradingGovernanceDecision = {
      ...input,
      id: randomUUID(),
      createdAt: now(),
      version: "phase1-governance-v1",
      reviewer: "TradingGovernanceEngine",
    };
    await writeJsonArray(GOVERNANCE_DECISIONS_PATH, [decision, ...decisions]);
    await this.appendMemory(`Governance decision recorded: ${decision.symbol || "trade"} => ${decision.decision}. ${decision.reason}`);
    return decision;
  },

  async listIncidentReports(userId?: string): Promise<TradingIncidentReport[]> {
    await ensureTradingDirs();
    const incidents = await readJsonArray<TradingIncidentReport>(INCIDENT_REPORTS_PATH);
    return incidents
      .filter((incident) => !userId || incident.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async addIncidentReport(input: Omit<TradingIncidentReport, "id" | "createdAt">): Promise<TradingIncidentReport> {
    const incidents = await readJsonArray<TradingIncidentReport>(INCIDENT_REPORTS_PATH);
    const incident: TradingIncidentReport = {
      ...input,
      id: randomUUID(),
      createdAt: now(),
    };
    await writeJsonArray(INCIDENT_REPORTS_PATH, [incident, ...incidents]);
    await this.appendMemory(`Trading incident recorded: ${incident.symbol || "trade"}. ${incident.incident}.`);
    return incident;
  },

  async getPerformance(userId?: string): Promise<TradingPerformanceReport> {
    const trades = await this.listPaperTrades(userId);
    const theses = await this.listTheses(userId);
    const closedTrades = trades.filter((trade) => trade.status === "closed");
    const openTrades = trades.filter((trade) => trade.status === "open");
    const winners = closedTrades.filter((trade) => (trade.realizedPnl || 0) > 0);
    const losers = closedTrades.filter((trade) => (trade.realizedPnl || 0) < 0);
    const realizedPnl = closedTrades.reduce((sum, trade) => sum + (trade.realizedPnl || 0), 0);
    const grossWins = winners.reduce((sum, trade) => sum + (trade.realizedPnl || 0), 0);
    const grossLosses = Math.abs(losers.reduce((sum, trade) => sum + (trade.realizedPnl || 0), 0));
    const totalRisk = closedTrades.reduce((sum, trade) => sum + Math.max(trade.riskAmount || 0, 0), 0);
    const averageRewardRisk = totalRisk > 0 ? realizedPnl / totalRisk : 0;
    const averageWinner = winners.length ? grossWins / winners.length : 0;
    const averageLoser = losers.length ? grossLosses / losers.length : 0;
    const winRate = closedTrades.length ? winners.length / closedTrades.length : 0;
    const expectancy = winRate * averageWinner - (1 - winRate) * averageLoser;
    const outcomes = closedTrades.map((trade) => trade.outcome);
    const patternAnalytics = buildPatternAnalytics(closedTrades, theses);

    await this.appendMemory(
      `Performance reviewed: ${closedTrades.length} closed trades, win rate ${(winRate * 100).toFixed(1)}%, realized P&L ${Number(realizedPnl.toFixed(2))}.`,
    );

    return {
      generatedAt: now(),
      totalTrades: trades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      winRate: Number(winRate.toFixed(4)),
      averageRewardRisk: Number(averageRewardRisk.toFixed(4)),
      expectancy: Number(expectancy.toFixed(4)),
      profitFactor: calculateProfitFactor(grossWins, grossLosses),
      averageWinner: Number(averageWinner.toFixed(4)),
      averageLoser: Number(averageLoser.toFixed(4)),
      realizedPnl: Number(realizedPnl.toFixed(4)),
      maximumDrawdown: calculateMaxDrawdown(closedTrades),
      consecutiveWins: longestRun(outcomes, "win"),
      consecutiveLosses: longestRun(outcomes, "loss"),
      mostSuccessfulSetups: patternAnalytics.highestWinRateSetups,
      leastSuccessfulSetups: patternAnalytics.lowestWinRateSetups,
      patternAnalytics,
      notes: [
        "Phase 1 is simulation-only. No broker connection or live execution exists.",
        closedTrades.length < 20
          ? "Sample size is still small. Avoid overfitting conclusions until more paper trades are logged."
          : "Sample size is becoming useful for setup validation.",
      ],
    };
  },

  async appendMemory(summary: string) {
    await ensureTradingDirs();
    const entry = `\n- ${now()}: ${summary}`;
    await fs.appendFile(TRADING_MEMORY_PATH, entry, "utf8");
  },
};
