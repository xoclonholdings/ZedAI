import type {
  TradeDirection,
  TradingAssetClass,
} from "../../../shared/trading-types";

import { buildTradingCurriculumContext } from "./TradingCurriculum";
import { TradingStore } from "./TradingStore";

/**
 * Autonomous "Generate Strategy" engine.
 *
 * Produces a *draft* trade plan for the New Strategy form using Zed's
 * learned trading framework — the "Trades By Sci" style captured in the
 * curriculum and any imported knowledge (market structure, liquidity
 * sweeps / draw on liquidity, entry confirmation, stop invalidation,
 * target / liquidity objective, and risk/reward discipline).
 *
 * This is generation only. There is no broker connection, no live price
 * feed, and no order transmission. Because there is no live market data
 * source wired in, the generator NEVER fabricates prices — it uses
 * structural language ("below the sweep low") instead of invented
 * numbers, and it clearly frames the output as a draft built from stored
 * rules and the provided symbol/context.
 */

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
  riskReward: number;
  confidence: number;
  thesis: string;
  marketStructure: string;
  liquidityAnalysis: string;
  entryPlan: string;
  stopPlan: string;
  targetPlan: string;
  invalidation: string;
  /** True when built purely from stored rules (no live data source). */
  draft: boolean;
  /** Short note explaining the generation basis, surfaced to the user. */
  basis: string;
}

const DEFAULT_TIMEFRAME = "Daily / 4H / 1H";

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 60;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundRR(value: number): number {
  const clamped = Math.max(2, Math.min(4, value));
  return Math.round(clamped * 10) / 10;
}

/**
 * Resolve "auto" into a concrete direction. With no live data feed we
 * cannot read live momentum, so we lean on any stored knowledge tone and
 * otherwise default to the higher-timeframe continuation (long) framing
 * the curriculum teaches. This is deliberately conservative and fully
 * editable by the user afterward.
 */
function resolveDirection(
  preference: DirectionPreference | undefined,
  knowledgeText: string,
): { direction: TradeDirection; auto: boolean } {
  if (preference === "long" || preference === "short") {
    return { direction: preference, auto: false };
  }
  const lower = knowledgeText.toLowerCase();
  const bearish =
    (lower.match(/bearish|lower high|lower low|breakdown|short/g) || []).length;
  const bullish =
    (lower.match(/bullish|higher high|higher low|breakout|continuation|long/g) || [])
      .length;
  const direction: TradeDirection = bearish > bullish ? "short" : "long";
  return { direction, auto: true };
}

function biasWord(direction: TradeDirection): string {
  return direction === "long" ? "bullish" : "bearish";
}

function sweepSide(direction: TradeDirection): string {
  return direction === "long" ? "sell-side" : "buy-side";
}

function drawSide(direction: TradeDirection): string {
  return direction === "long" ? "buy-side" : "sell-side";
}

function sweepLevel(direction: TradeDirection): string {
  return direction === "long" ? "the prior session / swing low" : "the prior session / swing high";
}

function drawLevel(direction: TradeDirection): string {
  return direction === "long" ? "the previous swing high" : "the previous swing low";
}

function buildThesis(direction: TradeDirection, timeframe: string): string {
  const bias = biasWord(direction);
  const swept = sweepSide(direction);
  const draw = drawSide(direction);
  const dir = direction === "long" ? "reclaimed support" : "rejected resistance";
  return [
    `Higher-timeframe trend remains ${bias} across ${timeframe}.`,
    `Price swept ${swept} liquidity beyond ${sweepLevel(direction)} and ${dir}.`,
    `Looking for continuation toward ${draw} liquidity resting at ${drawLevel(direction)}.`,
  ].join(" ");
}

function buildMarketStructure(direction: TradeDirection, timeframe: string): string {
  const bias = biasWord(direction);
  const swings = direction === "long" ? "higher highs and higher lows" : "lower highs and lower lows";
  const bos = direction === "long" ? "bullish break of structure" : "bearish break of structure";
  return [
    `Daily and 4H structure remain ${bias} with ${swings}.`,
    `1H shows a ${bos} after the sweep, confirming intent in the direction of the higher-timeframe bias (${timeframe}).`,
  ].join(" ");
}

function buildLiquidityAnalysis(direction: TradeDirection): string {
  const swept = sweepSide(direction);
  const draw = drawSide(direction);
  return [
    `${swept.charAt(0).toUpperCase() + swept.slice(1)} liquidity beyond ${sweepLevel(direction)} has already been taken (stop hunt / sweep).`,
    `${draw.charAt(0).toUpperCase() + draw.slice(1)} liquidity above/below ${drawLevel(direction)} remains the likely draw on price.`,
  ].join(" ");
}

function buildEntryPlan(direction: TradeDirection): string {
  const zone = direction === "long" ? "reclaimed support" : "rejected resistance";
  const side = direction === "long" ? "above" : "below";
  return [
    `Wait for a 15m confirmation candle ${side} ${zone}.`,
    `Enter on the retrace back into the confirmation zone with predefined risk — no chasing, confirmation before commitment.`,
  ].join(" ");
}

function buildStopPlan(direction: TradeDirection): string {
  const beyond = direction === "long" ? "below the sweep low" : "above the sweep high";
  const fail = direction === "long"
    ? "closes back below reclaimed support"
    : "closes back above rejected resistance";
  return [
    `Stop sits ${beyond} — the point that invalidates the setup structurally.`,
    `Exit early if price ${fail} or market structure fails in the trade direction.`,
  ].join(" ");
}

function buildTargetPlan(direction: TradeDirection): string {
  const trail = direction === "long" ? "higher lows" : "lower highs";
  return [
    `TP1 at ${drawLevel(direction)} (prior swing objective).`,
    `TP2 at the ${drawSide(direction)} liquidity pool.`,
    `Trail the remaining position using ${trail} once TP1 is banked.`,
  ].join(" ");
}

function buildInvalidation(direction: TradeDirection): string[] {
  const structuralClose = direction === "long"
    ? "1H close below the sweep low"
    : "1H close above the sweep high";
  const flip = direction === "long"
    ? "Daily structure flips bearish"
    : "Daily structure flips bullish";
  return [
    structuralClose,
    flip,
    "High-impact news invalidates the setup",
    "Gap against the position beyond planned risk",
  ];
}

/**
 * Confidence is a structural score (0-100), not a probability or a
 * promise. It reflects how much of the learned framework the draft is
 * grounded in — never certainty.
 */
function scoreConfidence(knowledgeMatches: number, auto: boolean): number {
  let score = 62; // baseline for a clean structural draft
  score += Math.min(16, knowledgeMatches * 4); // grounded in stored rules
  if (!auto) score += 6; // user-specified direction adds conviction
  return clampConfidence(score);
}

export async function generateTradeStrategy(
  input: GenerateStrategyInput,
): Promise<GeneratedStrategy> {
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim() || DEFAULT_TIMEFRAME;

  // Wire into the existing learned framework: stored knowledge + curriculum.
  const knowledgeEntries = await TradingStore.searchKnowledge(
    `${symbol} ${input.asset} ${input.market} market structure liquidity sweep entry stop target`,
    6,
  );
  const knowledgeText = [
    buildTradingCurriculumContext(),
    ...knowledgeEntries.flatMap((entry) => [
      ...entry.rules,
      ...entry.patterns,
      ...entry.entryCriteria,
      ...entry.riskRules,
    ]),
  ].join("\n");

  const { direction, auto } = resolveDirection(input.directionPreference, knowledgeText);

  const riskReward = roundRR(3.0);
  const confidence = scoreConfidence(knowledgeEntries.length, auto);

  const draft = true; // no live market data source is wired in
  const basis = knowledgeEntries.length
    ? `Zed drafted this strategy from ${knowledgeEntries.length} stored knowledge match(es) and its learned Trades By Sci framework. No live market data — price levels are structural, not fixed numbers. Review and edit before saving.`
    : "Zed drafted this strategy from its learned Trades By Sci framework (no stored knowledge matched yet). No live market data — price levels are structural, not fixed numbers. Review and edit before saving.";

  const strategy: GeneratedStrategy = {
    market: input.market,
    asset: input.asset,
    symbol,
    direction,
    timeframe,
    riskReward,
    confidence,
    thesis: buildThesis(direction, timeframe),
    marketStructure: buildMarketStructure(direction, timeframe),
    liquidityAnalysis: buildLiquidityAnalysis(direction),
    entryPlan: buildEntryPlan(direction),
    stopPlan: buildStopPlan(direction),
    targetPlan: buildTargetPlan(direction),
    invalidation: buildInvalidation(direction).join("\n"),
    draft,
    basis,
  };

  if (input.userId) {
    await TradingStore.appendMemory(
      `Strategy generated (draft): ${symbol || "?"} ${direction} on ${timeframe} — R:R ${riskReward}, confidence ${confidence}.`,
    );
  }

  return strategy;
}
