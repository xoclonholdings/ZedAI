import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { HUB_DIR, HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import type {
  PaperTrade,
  PaperTradeStatus,
  TradeThesis,
  TradingKnowledgeEntry,
  TradingPerformanceReport,
} from "../../../shared/trading-types";

const TRADING_DIR = path.resolve(HUB_DIR, "trading");
const KNOWLEDGE_PATH = path.resolve(TRADING_DIR, "knowledge.json");
const THESES_PATH = path.resolve(TRADING_DIR, "trade-theses.json");
const PAPER_TRADES_PATH = path.resolve(TRADING_DIR, "paper-trades.json");
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
    await this.appendMemory(`Paper trade opened: ${trade.symbol} ${trade.direction} entry ${trade.entry}, stop ${trade.stop}, target ${trade.target}.`);
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
    const index = trades.findIndex((trade) => trade.id === input.id && trade.userId === input.userId);
    if (index === -1) return null;

    const existing = trades[index];
    if (existing.status !== "open") return existing;

    const realizedPnl = calculateRealizedPnl(existing, input.exitPrice);
    const updated: PaperTrade = {
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

    trades[index] = updated;
    await writeJsonArray(PAPER_TRADES_PATH, trades);
    await this.appendMemory(`Paper trade closed: ${updated.symbol} ${updated.direction} exit ${input.exitPrice}, P&L ${realizedPnl}.`);
    return updated;
  },

  async getPerformance(userId?: string): Promise<TradingPerformanceReport> {
    const trades = await this.listPaperTrades(userId);
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

    return {
      generatedAt: now(),
      totalTrades: trades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      winRate: Number(winRate.toFixed(4)),
      averageRewardRisk: Number(averageRewardRisk.toFixed(4)),
      expectancy: Number(expectancy.toFixed(4)),
      profitFactor: grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(4)) : grossWins > 0 ? Infinity : 0,
      averageWinner: Number(averageWinner.toFixed(4)),
      averageLoser: Number(averageLoser.toFixed(4)),
      realizedPnl: Number(realizedPnl.toFixed(4)),
      maximumDrawdown: calculateMaxDrawdown(closedTrades),
      consecutiveWins: longestRun(outcomes, "win"),
      consecutiveLosses: longestRun(outcomes, "loss"),
      mostSuccessfulSetups: [],
      leastSuccessfulSetups: [],
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
