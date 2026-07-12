import { executeProviderChat } from "../../core/providers/provider-executor";
import type {
  TradeDirection,
  TradingAssetClass,
} from "../../../shared/trading-types";

import { buildTradingCurriculumContext } from "./TradingCurriculum";
import { TradingStore } from "./TradingStore";

export type DirectionPreference = "long" | "short" | "auto";

export interface GenerateStrategyInput {
  userId?: string;
  symbol: string;
  asset: TradingAssetClass;
  market: string;
  directionPreference?: DirectionPreference;
  timeframe?: string;
}

export interface GeneratedStrategy {
  market: string;
  asset: TradingAssetClass;
  symbol: string;
  direction: TradeDirection;
  timeframe: string;
  setupName: string;
  entry: number;
  stop: number;
  target: number;
  size: number;
  riskAmount: number;
  riskReward: number;
  confidence: number;
  thesis: string;
  marketStructure: string;
  liquidityAnalysis: string;
  timeframeAlignment: Record<string, string>;
  entryPlan: string;
  stopPlan: string;
  targetPlan: string;
  invalidation: string;
  draft: boolean;
  basis: string;
}

const DEFAULT_TIMEFRAME = "Daily / 4H / 1H";
const MAX_PAPER_RISK = 100;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function roundRiskReward(value: number): number {
  return Number(value.toFixed(2));
}

function extractJsonObject(value: string): Record<string, unknown> {
  const withoutFence = value.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Lightning did not return a structured trade proposal.");
  return JSON.parse(withoutFence.slice(start, end + 1));
}

function requireText(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Trade proposal missing ${key}.`);
  return value.trim();
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const value = toNumber(obj[key]);
  if (!Number.isFinite(value)) throw new Error(`Trade proposal missing numeric ${key}.`);
  return value;
}

function directionFrom(value: unknown, preference?: DirectionPreference): TradeDirection {
  if (preference === "long" || preference === "short") return preference;
  return String(value).toLowerCase() === "short" ? "short" : "long";
}

function riskRewardFrom(direction: TradeDirection, entry: number, stop: number, target: number): number {
  const risk = direction === "long" ? entry - stop : stop - entry;
  const reward = direction === "long" ? target - entry : entry - target;
  if (risk <= 0 || reward <= 0) throw new Error("Trade proposal has invalid entry, stop, or target geometry.");
  return roundRiskReward(reward / risk);
}

function normalizeTimeframeAlignment(value: unknown, timeframe: string): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" && v.trim())
      .map(([k, v]) => [k, String(v).trim()]);
    if (entries.length) return Object.fromEntries(entries);
  }
  return { primary: timeframe, confirmation: "Zed proposal generated for paper-trade validation." };
}

function buildPrompt(input: GenerateStrategyInput, context: string): string {
  return [
    "Create one complete paper-trade proposal for ZED Trading Sandbox.",
    "This is paper trading only. Do not discuss live execution or broker orders.",
    "Fill every field. Do not ask the user to provide entry, stop, target, thesis, setup, or risk.",
    "Use the symbol, asset class, market, stored trading framework, and recent performance context to create a proposal that differs by symbol and setup.",
    "Return JSON only. No markdown. No template language. No placeholders.",
    "Required JSON keys: direction, timeframe, setupName, entry, stop, target, size, riskAmount, confidence, thesis, marketStructure, liquidityAnalysis, timeframeAlignment, entryPlan, stopPlan, targetPlan, invalidation, basis.",
    "Rules: direction must be long or short. riskAmount must be <= 100. riskReward must be at least 2.0. For long trades stop < entry < target. For short trades target < entry < stop.",
    "If current price is unknown, choose internally consistent paper-trade levels suitable for strategy validation and explain that basis in the basis field.",
    "",
    `Symbol: ${input.symbol}`,
    `Asset class: ${input.asset}`,
    `Market: ${input.market}`,
    `Direction preference: ${input.directionPreference || "auto"}`,
    `Preferred timeframe: ${input.timeframe || DEFAULT_TIMEFRAME}`,
    "",
    "Trading context:",
    context,
  ].join("\n");
}

export async function generateTradeStrategy(
  input: GenerateStrategyInput,
): Promise<GeneratedStrategy> {
  const symbol = String(input.symbol || "").trim().toUpperCase();
  if (!symbol) throw new Error("Symbol is required for a trade proposal.");
  const timeframe = String(input.timeframe || "").trim() || DEFAULT_TIMEFRAME;

  const knowledgeEntries = await TradingStore.searchKnowledge(
    `${symbol} ${input.asset} ${input.market} market structure liquidity sweep entry stop target`,
    8,
  );
  const performance = input.userId ? await TradingStore.getPerformance(input.userId) : null;
  const recentTrades = input.userId ? (await TradingStore.listPaperTrades(input.userId)).slice(0, 8) : [];

  const context = [
    buildTradingCurriculumContext(),
    knowledgeEntries.length
      ? `Stored knowledge matches:\n${knowledgeEntries.map((entry) => [
          `Title: ${entry.title}`,
          ...entry.rules.map((rule) => `Rule: ${rule}`),
          ...entry.patterns.map((pattern) => `Pattern: ${pattern}`),
          ...entry.entryCriteria.map((criterion) => `Entry: ${criterion}`),
          ...entry.riskRules.map((rule) => `Risk: ${rule}`),
        ].join("\n")).join("\n\n")}`
      : "Stored knowledge matches: none for this symbol yet.",
    performance
      ? `Performance: ${performance.closedTrades} closed trades, win rate ${Math.round(performance.winRate * 100)}%, expectancy ${performance.expectancy}, max drawdown ${performance.maximumDrawdown}.`
      : "Performance: unavailable.",
    recentTrades.length
      ? `Recent paper trades:\n${recentTrades.map((trade) => `${trade.symbol} ${trade.direction} ${trade.setupName || "setup"} outcome ${trade.outcome || trade.status}`).join("\n")}`
      : "Recent paper trades: none.",
  ].join("\n\n");

  const reply = await executeProviderChat(
    [{ role: "user", content: buildPrompt({ ...input, symbol, timeframe }, context) }],
    {
      lane: "finance",
      reasoningEffort: "high",
      temperature: 0.35,
      maxTokens: 1400,
      systemPrompt: "You are ZED's Trading Intelligence Agent. Produce complete, symbol-specific paper-trade proposals as strict JSON. Never return templates, placeholders, or generic repeated setup text.",
    },
  );

  const raw = extractJsonObject(reply);
  const direction = directionFrom(raw.direction, input.directionPreference);
  const entry = roundPrice(requireNumber(raw, "entry"));
  const stop = roundPrice(requireNumber(raw, "stop"));
  const target = roundPrice(requireNumber(raw, "target"));
  const riskReward = riskRewardFrom(direction, entry, stop, target);
  if (riskReward < 2) throw new Error("Trade proposal failed minimum 2:1 risk/reward validation.");

  const requestedSize = Math.max(1, Math.floor(requireNumber(raw, "size")));
  const perUnitRisk = Math.abs(entry - stop);
  const maxRiskSize = perUnitRisk > 0 ? Math.max(1, Math.floor(MAX_PAPER_RISK / perUnitRisk)) : requestedSize;
  const size = Math.max(1, Math.min(requestedSize, maxRiskSize));
  const riskAmount = roundPrice(Math.min(MAX_PAPER_RISK, perUnitRisk * size));

  const strategy: GeneratedStrategy = {
    market: input.market,
    asset: input.asset,
    symbol,
    direction,
    timeframe: requireText(raw, "timeframe") || timeframe,
    setupName: requireText(raw, "setupName"),
    entry,
    stop,
    target,
    size,
    riskAmount,
    riskReward,
    confidence: clamp(Math.round(requireNumber(raw, "confidence")), 1, 100),
    thesis: requireText(raw, "thesis"),
    marketStructure: requireText(raw, "marketStructure"),
    liquidityAnalysis: requireText(raw, "liquidityAnalysis"),
    timeframeAlignment: normalizeTimeframeAlignment(raw.timeframeAlignment, timeframe),
    entryPlan: requireText(raw, "entryPlan"),
    stopPlan: requireText(raw, "stopPlan"),
    targetPlan: requireText(raw, "targetPlan"),
    invalidation: requireText(raw, "invalidation"),
    draft: true,
    basis: requireText(raw, "basis"),
  };

  if (input.userId) {
    await TradingStore.appendMemory(
      `Lightning paper proposal generated: ${strategy.symbol} ${strategy.direction} ${strategy.setupName}; entry ${strategy.entry}, stop ${strategy.stop}, target ${strategy.target}, R:R ${strategy.riskReward}.`,
    );
  }

  return strategy;
}
