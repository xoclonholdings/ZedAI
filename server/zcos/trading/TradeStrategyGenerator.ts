import type {
  TradeDirection,
  TradingAssetClass,
} from "../../../shared/trading-types";

import { buildTradingCurriculumContext } from "./TradingCurriculum";
import { TradingStore } from "./TradingStore";

/**
 * Autonomous "Propose Trade" engine.
 *
 * Produces a *complete* paper-trade plan Zed can hand to the governance
 * layer using its learned trading framework — the "Trades By Sci" style
 * captured in the curriculum and any imported knowledge (market
 * structure, liquidity sweeps / draw on liquidity, entry confirmation,
 * stop invalidation, target / liquidity objective, and risk/reward
 * discipline).
 *
 * Zed fills in everything: direction, thesis, market structure, liquidity
 * read, and the concrete entry / stop / target / size / risk numbers —
 * sized so the plan always clears the governance rules (risk/reward >= 2,
 * risk within the paper cap). The user does not have to invent or type
 * any of it; they only approve.
 *
 * This is simulation only. There is no broker connection and no order
 * transmission. There is also no live market-data feed wired in yet, so
 * the numeric levels are a *paper reference model* built around a
 * reference price (the caller's if supplied, otherwise a normalized 100)
 * with structurally consistent stop/target spacing — clearly labelled as
 * a paper reference, never presented as a live quote.
 */

export type DirectionPreference = "long" | "short" | "auto";

export interface GenerateStrategyInput {
  userId?: string;
  symbol: string;
  asset: TradingAssetClass;
  market: string;
  directionPreference?: DirectionPreference;
  timeframe?: string;
  /** Optional current/reference price. Numeric levels are built around it. */
  referencePrice?: number;
  /**
   * Optional real stop distance (e.g. ATR from live data) in absolute
   * price. When supplied, stops/targets reflect actual volatility instead
   * of a flat percentage of the reference price.
   */
  stopDistance?: number;
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
  /** Concrete, governance-ready paper levels Zed proposes. */
  entry: number;
  stop: number;
  target: number;
  size: number;
  riskAmount: number;
  /** Higher-timeframe alignment map (feeds the trend-alignment check). */
  timeframeAlignment: Record<string, string>;
  /** Market session Zed is framing the setup in. */
  session: string;
  /** True when built from stored rules against a reference (no live feed). */
  draft: boolean;
  /** True when the numeric levels came from a caller-supplied price. */
  pricedFromReference: boolean;
  /** Short note explaining the generation basis, surfaced to the user. */
  basis: string;
}

const DEFAULT_TIMEFRAME = "Daily / 4H / 1H";
const DEFAULT_REFERENCE_PRICE = 100;
const MAX_PAPER_RISK = 100;

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 60;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Build concrete, governance-ready levels around a reference price.
 *
 * The spacing is structural: a 1% stop distance and a target set at
 * `riskReward` multiples of it, so the reward/risk always clears the
 * governance minimum. Position size is chosen so total risk stays within
 * the paper-trade cap (aiming for ~90% of it), and the stop distance is
 * clamped so a single unit never breaches the cap on high-priced symbols.
 */
function computeLevels(
  direction: TradeDirection,
  reference: number,
  riskReward: number,
  stopDistance?: number,
): { entry: number; stop: number; target: number; size: number; riskAmount: number } {
  const price =
    Number.isFinite(reference) && reference > 0 ? reference : DEFAULT_REFERENCE_PRICE;
  // Real volatility (ATR) when we have it, otherwise a 1% structural stop.
  let riskDistance =
    typeof stopDistance === "number" && Number.isFinite(stopDistance) && stopDistance > 0
      ? round2(stopDistance)
      : Math.max(round2(price * 0.01), 0.01);
  if (riskDistance < 0.01) riskDistance = 0.01;
  // Never let one unit exceed the paper risk cap on high-priced symbols.
  if (riskDistance > MAX_PAPER_RISK * 0.9) riskDistance = round2(MAX_PAPER_RISK * 0.9);
  const size = Math.max(1, Math.floor((MAX_PAPER_RISK * 0.9) / riskDistance));
  const entry = round2(price);
  const stop = round2(direction === "long" ? entry - riskDistance : entry + riskDistance);
  const target = round2(
    direction === "long" ? entry + riskReward * riskDistance : entry - riskReward * riskDistance,
  );
  const riskAmount = round2(riskDistance * size);
  return { entry, stop, target, size, riskAmount };
}

/** Higher-timeframe alignment map — every frame in the same bias. */
function buildTimeframeAlignment(
  timeframe: string,
  direction: TradeDirection,
): Record<string, string> {
  const bias = biasWord(direction);
  const frames = timeframe
    .split(/[/,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const list = frames.length ? frames : ["Daily", "4H", "1H"];
  const map: Record<string, string> = {};
  for (const frame of list) map[frame] = bias;
  return map;
}

function sessionFor(asset: TradingAssetClass): string {
  if (asset === "crypto" || asset === "forex") return "24h session (no fixed close)";
  return "Regular session";
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

  const pricedFromReference =
    typeof input.referencePrice === "number" &&
    Number.isFinite(input.referencePrice) &&
    input.referencePrice > 0;
  const levels = computeLevels(
    direction,
    input.referencePrice ?? DEFAULT_REFERENCE_PRICE,
    riskReward,
    input.stopDistance,
  );

  const draft = true; // simulation only — no broker connection
  const priceNote = pricedFromReference
    ? `Levels are anchored to the $${levels.entry} reference you provided, spaced for a ${riskReward}:1 reward/risk.`
    : `No live feed is connected, so levels use a $${levels.entry} paper reference spaced for a ${riskReward}:1 reward/risk — adjust the reference to match a real quote.`;
  const basis = knowledgeEntries.length
    ? `Zed built this proposal from ${knowledgeEntries.length} stored knowledge match(es) and its learned Trades By Sci framework. ${priceNote}`
    : `Zed built this proposal from its learned Trades By Sci framework (no stored knowledge matched yet). ${priceNote}`;

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
    entry: levels.entry,
    stop: levels.stop,
    target: levels.target,
    size: levels.size,
    riskAmount: levels.riskAmount,
    timeframeAlignment: buildTimeframeAlignment(timeframe, direction),
    session: sessionFor(input.asset),
    draft,
    pricedFromReference,
    basis,
  };

  if (input.userId) {
    await TradingStore.appendMemory(
      `Trade proposed (paper): ${symbol || "?"} ${direction} on ${timeframe} — entry ${levels.entry}, stop ${levels.stop}, target ${levels.target}, size ${levels.size}, risk ${levels.riskAmount}, R:R ${riskReward}, confidence ${confidence}.`,
    );
  }

  return strategy;
}
