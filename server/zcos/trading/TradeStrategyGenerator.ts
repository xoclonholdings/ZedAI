import type {
  TradeDirection,
  TradingAssetClass,
} from "../../../shared/trading-types";
import type { TradingSignal } from "../../../shared/trading-training-types";
import type { MarketStructureAnalysis } from "../../../shared/market-structure-types";

import { executeProviderChat } from "../../core/providers/provider-executor";
import { buildTradingCurriculumContext } from "./TradingCurriculum";
import { TradingStore } from "./TradingStore";

/**
 * Autonomous "Propose Trade" engine.
 *
 * Produces a *complete* paper-trade plan ZAR can hand to the governance
 * layer using its learned trading framework — the "Trades By Sci" style
 * captured in the curriculum and any imported knowledge (market
 * structure, liquidity sweeps / draw on liquidity, entry confirmation,
 * stop invalidation, target / liquidity objective, and risk/reward
 * discipline).
 *
 * ZAR fills in everything: direction, thesis, market structure, liquidity
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
  /** Live technical signal, when available — grounds the thesis in real reads. */
  signal?: TradingSignal | null;
  /**
   * Real, computed market structure (swings, BOS/CHoCH, liquidity, order
   * blocks, multi-timeframe alignment) from the Market Structure Engine,
   * when live bars were reachable. Replaces the generic structural prose
   * with facts specific to this symbol's actual price action.
   */
  structureAnalysis?: MarketStructureAnalysis | null;
}

export interface GeneratedStrategy {
  market: string;
  asset: TradingAssetClass;
  symbol: string;
  direction: TradeDirection;
  timeframe: string;
  riskReward: number;
  confidence: number;
  setupType: string;
  thesis: string;
  marketStructure: string;
  liquidityAnalysis: string;
  entryPlan: string;
  stopPlan: string;
  targetPlan: string;
  invalidation: string;
  /** Concrete, governance-ready paper levels ZAR proposes. */
  entry: number;
  stop: number;
  target: number;
  size: number;
  riskAmount: number;
  /** Higher-timeframe alignment map (feeds the trend-alignment check). */
  timeframeAlignment: Record<string, string>;
  /** Market session ZAR is framing the setup in. */
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
  signal?: TradingSignal | null,
): { direction: TradeDirection; auto: boolean } {
  if (preference === "long" || preference === "short") {
    return { direction: preference, auto: false };
  }
  if (signal?.signal === "buy") return { direction: "long", auto: true };
  if (signal?.signal === "sell") return { direction: "short", auto: true };
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

/** Real structure/liquidity text from the Market Structure Engine, when available. */
function buildEngineMarketStructure(structure: MarketStructureAnalysis): string {
  const primary = structure.timeframes.find((t) => t.timeframe === structure.primaryTimeframe) || structure.timeframes[0];
  const parts = [structure.explanation];
  if (structure.timeframes.length > 1) {
    const trendList = structure.timeframes.map((t) => `${t.timeframe}: ${t.trend}`).join("; ");
    parts.push(`Trend by timeframe — ${trendList}.`);
  }
  if (primary) {
    parts.push(`Internal structure is ${primary.internalStructure}; external structure is ${primary.externalStructure}.`);
  }
  return parts.join(" ");
}

function buildEngineLiquidityAnalysis(structure: MarketStructureAnalysis): string {
  const primary = structure.timeframes.find((t) => t.timeframe === structure.primaryTimeframe) || structure.timeframes[0];
  if (!primary) return "No liquidity levels were computed.";
  const swept = primary.liquidity.filter((l) => l.status === "swept");
  const active = primary.liquidity.filter((l) => l.status === "active");
  const sentences: string[] = [];
  if (swept.length) {
    const last = swept[swept.length - 1];
    sentences.push(`${last.kind.replace(/_/g, " ")} near ${last.price} has already been swept.`);
  } else {
    sentences.push("No liquidity pool on this timeframe has been swept yet.");
  }
  const nearestAbove = active.filter((l) => l.price > primary.lastClose).sort((a, b) => a.price - b.price)[0];
  const nearestBelow = active.filter((l) => l.price < primary.lastClose).sort((a, b) => b.price - a.price)[0];
  if (nearestAbove) sentences.push(`The nearest resting liquidity above price sits near ${nearestAbove.price} (${nearestAbove.kind.replace(/_/g, " ")}).`);
  if (nearestBelow) sentences.push(`The nearest resting liquidity below price sits near ${nearestBelow.price} (${nearestBelow.kind.replace(/_/g, " ")}).`);
  return sentences.join(" ");
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
function scoreConfidence(
  knowledgeMatches: number,
  auto: boolean,
  signal?: TradingSignal | null,
  structure?: MarketStructureAnalysis | null,
): number {
  if (structure) {
    // Confluence already synthesizes structure, liquidity, alignment, and
    // indicator agreement — anchor on it and only lightly adjust for the
    // remaining, structure-independent inputs.
    let score = structure.confluence.score;
    score += Math.min(8, knowledgeMatches * 2);
    if (!auto) score += 4;
    return clampConfidence(score);
  }
  let score = 62; // baseline for a clean structural draft
  score += Math.min(16, knowledgeMatches * 4); // grounded in stored rules
  if (!auto) score += 6; // user-specified direction adds conviction
  if (signal && signal.signal !== "neutral") score += Math.round(signal.strength * 0.12); // real indicator agreement
  return clampConfidence(score);
}

function inferSetupType(direction: TradeDirection, signal?: TradingSignal | null, structure?: MarketStructureAnalysis | null): string {
  if (structure) return structure.setupTag;
  const rsiVote = signal?.votes.find((vote) => vote.name === "RSI 14")?.detail || "";
  const momentum = signal?.votes.find((vote) => vote.name === "Momentum")?.verdict;
  if (/overbought/i.test(rsiVote) && direction === "short") return "Mean-reversion short";
  if (/oversold/i.test(rsiVote) && direction === "long") return "Mean-reversion long";
  if (momentum === "bullish" && direction === "long") return "Momentum continuation";
  if (momentum === "bearish" && direction === "short") return "Breakdown continuation";
  return direction === "long" ? "Liquidity reclaim long" : "Liquidity rejection short";
}

/**
 * A thesis grounded in the actual indicator reads for THIS symbol — not a
 * canned narrative. Cites the live price, the technical signal, each
 * indicator's vote, and the concrete levels, so every proposal reads
 * differently and reflects real analysis. Falls back to structural
 * language only when no live signal is available.
 */
function buildDataDrivenThesis(
  symbol: string,
  direction: TradeDirection,
  levels: { entry: number; stop: number; target: number },
  riskReward: number,
  signal: TradingSignal | null | undefined,
): string {
  if (!signal || signal.signal === "neutral") {
    return buildThesis(direction, DEFAULT_TIMEFRAME);
  }
  const agree = direction === "long" ? signal.bullish : signal.bearish;
  const total = signal.votes.length;
  const reads = signal.votes
    .filter((v) => v.verdict !== "neutral")
    .map((v) => `${v.name} ${v.verdict} (${v.detail})`)
    .join("; ");
  const bias = direction === "long" ? "long" : "short";
  return [
    `${symbol} at $${levels.entry}: technical ${signal.signal.toUpperCase()} with ${signal.strength}% conviction — ${agree}/${total} indicators back a ${bias}.`,
    reads ? `Reads: ${reads}.` : "",
    `Plan: ${bias} at $${levels.entry}, stop $${levels.stop}, target $${levels.target} for ${riskReward}:1. Invalidates on a close through the stop.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateTradeStrategy(
  input: GenerateStrategyInput,
): Promise<GeneratedStrategy> {
  const symbol = String(input.symbol || "").trim().toUpperCase();
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

  try {
    const strategy = await generateModelTradeStrategy(input, knowledgeEntries, knowledgeText);
    if (input.userId) {
      await TradingStore.appendMemory(
        `Trade proposed by Lightning: ${strategy.symbol || "?"} ${strategy.direction} on ${strategy.timeframe}; entry ${strategy.entry}, stop ${strategy.stop}, target ${strategy.target}, size ${strategy.size}, risk ${strategy.riskAmount}, R:R ${strategy.riskReward}, confidence ${strategy.confidence}.`,
      );
    }
    return strategy;
  } catch (error) {
    await TradingStore.appendMemory(
      `Lightning trade proposal failed; rules fallback used. ${error instanceof Error ? error.message : String(error)}`,
    );
    return generateRuleBasedTradeStrategy(input);
  }
}

interface ModelTradeProposal {
  direction?: TradeDirection;
  timeframe?: string;
  riskReward?: number;
  confidence?: number;
  setupType?: string;
  thesis?: string;
  marketStructure?: string;
  liquidityAnalysis?: string;
  entryPlan?: string;
  stopPlan?: string;
  targetPlan?: string;
  invalidation?: string[] | string;
  entry?: number;
  stop?: number;
  target?: number;
  size?: number;
  riskAmount?: number;
  timeframeAlignment?: Record<string, string>;
  session?: string;
  basis?: string;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Lightning returned a trade proposal without a JSON object.");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

function cleanText(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`Lightning trade proposal is missing ${field}.`);
  return text.replace(/```[\s\S]*?```/g, "").replace(/\*\*/g, "").trim();
}

function cleanNumber(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Lightning trade proposal has an invalid ${field}.`);
  }
  return round2(parsed);
}

function normalizeDirection(value: unknown): TradeDirection {
  const direction = String(value || "").toLowerCase();
  if (direction === "long" || direction === "short") return direction;
  throw new Error("Lightning trade proposal is missing a valid direction.");
}

function normalizeRiskReward(direction: TradeDirection, entry: number, stop: number, target: number): number {
  const risk = direction === "long" ? entry - stop : stop - entry;
  const reward = direction === "long" ? target - entry : entry - target;
  if (risk <= 0 || reward <= 0) {
    throw new Error("Lightning trade proposal has entry, stop, and target on the wrong side.");
  }
  const rr = round2(reward / risk);
  if (rr < 2) {
    throw new Error("Lightning trade proposal failed the minimum 2:1 reward/risk rule.");
  }
  return rr;
}

function normalizeInvalidation(value: ModelTradeProposal["invalidation"]): string {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    if (items.length) return items.join("\n");
  }
  return cleanText(value, "invalidation");
}

function normalizeTimeframeAlignment(
  value: unknown,
  timeframe: string,
  direction: TradeDirection,
): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key.trim(), String(item || "").trim()] as const)
      .filter(([key, item]) => key && item);
    if (entries.length) return Object.fromEntries(entries);
  }
  return buildTimeframeAlignment(timeframe, direction);
}

function normalizeModelProposal(
  input: GenerateStrategyInput,
  proposal: ModelTradeProposal,
  knowledgeMatches: number,
  pricedFromReference: boolean,
): GeneratedStrategy {
  const direction = normalizeDirection(proposal.direction);
  const timeframe = cleanText(proposal.timeframe || input.timeframe || DEFAULT_TIMEFRAME, "timeframe");
  const entry = cleanNumber(proposal.entry, "entry");
  const stop = cleanNumber(proposal.stop, "stop");
  const target = cleanNumber(proposal.target, "target");
  const size = Math.max(1, Math.floor(cleanNumber(proposal.size, "size")));
  const riskAmount = proposal.riskAmount === undefined
    ? round2(Math.abs(entry - stop) * size)
    : cleanNumber(proposal.riskAmount, "riskAmount");
  const computedRiskReward = normalizeRiskReward(direction, entry, stop, target);
  const riskReward = Math.max(computedRiskReward, roundRR(Number(proposal.riskReward || computedRiskReward)));

  return {
    market: input.market,
    asset: input.asset,
    symbol: String(input.symbol || "").trim().toUpperCase(),
    direction,
    timeframe,
    riskReward,
    confidence: clampConfidence(Number(proposal.confidence || scoreConfidence(knowledgeMatches, false, input.signal, input.structureAnalysis))),
    setupType: cleanText(proposal.setupType || inferSetupType(direction, input.signal, input.structureAnalysis), "setupType"),
    thesis: cleanText(proposal.thesis, "thesis"),
    marketStructure: cleanText(proposal.marketStructure, "marketStructure"),
    liquidityAnalysis: cleanText(proposal.liquidityAnalysis, "liquidityAnalysis"),
    entryPlan: cleanText(proposal.entryPlan, "entryPlan"),
    stopPlan: cleanText(proposal.stopPlan, "stopPlan"),
    targetPlan: cleanText(proposal.targetPlan, "targetPlan"),
    invalidation: normalizeInvalidation(proposal.invalidation),
    entry,
    stop,
    target,
    size,
    riskAmount,
    timeframeAlignment: normalizeTimeframeAlignment(proposal.timeframeAlignment, timeframe, direction),
    session: cleanText(proposal.session || sessionFor(input.asset), "session"),
    draft: true,
    pricedFromReference,
    basis: cleanText(
      proposal.basis ||
        `Generated by Lightning AI from ${knowledgeMatches} stored trading knowledge match(es), current request context, and governance risk rules.`,
      "basis",
    ),
  };
}

async function generateModelTradeStrategy(
  input: GenerateStrategyInput,
  knowledgeEntries: Awaited<ReturnType<typeof TradingStore.searchKnowledge>>,
  knowledgeText: string,
): Promise<GeneratedStrategy> {
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const pricedFromReference =
    typeof input.referencePrice === "number" &&
    Number.isFinite(input.referencePrice) &&
    input.referencePrice > 0;

  const context = {
    symbol,
    asset: input.asset,
    market: input.market,
    directionPreference: input.directionPreference || "auto",
    timeframe: input.timeframe || DEFAULT_TIMEFRAME,
    referencePrice: input.referencePrice ?? null,
    stopDistance: input.stopDistance ?? null,
    liveMarketDataAvailable: pricedFromReference,
    minimumRewardRisk: 2,
    maxPaperRisk: MAX_PAPER_RISK,
    computedMarketStructure: input.structureAnalysis
      ? {
          explanation: input.structureAnalysis.explanation,
          confluenceScore: input.structureAnalysis.confluence.score,
          confluenceFactors: input.structureAnalysis.confluence.factors,
          timeframeTrends: Object.fromEntries(input.structureAnalysis.timeframes.map((t) => [t.timeframe, t.trend])),
          alignment: input.structureAnalysis.alignment.summary,
          setupTag: input.structureAnalysis.setupTag,
          instruction:
            "Use these computed structure facts as the ground truth for marketStructure/liquidityAnalysis/timeframeAlignment — describe them in plain language, do not contradict or invent additional structure beyond what's given here.",
        }
      : null,
    recentKnowledge: knowledgeEntries.slice(0, 4).map((entry) => ({
      title: entry.title,
      rules: entry.rules.slice(0, 5),
      patterns: entry.patterns.slice(0, 5),
      entryCriteria: entry.entryCriteria.slice(0, 5),
      riskRules: entry.riskRules.slice(0, 5),
    })),
  };

  const response = await executeProviderChat(
    [
      {
        role: "system",
        content: [
          "You are ZAR's Trading Intelligence proposal engine.",
          "Return one complete paper-trade proposal as strict JSON only.",
          "Do not return markdown, code fences, tables, templates, placeholders, or commentary.",
          "Use the provided symbol, market, knowledge, and risk rules.",
          "If liveMarketDataAvailable is false, do not claim live pricing; use a clearly disclosed paper reference basis.",
          "The proposal must be specific to this symbol and must not reuse generic wording.",
          "Entry, stop, target, size, and riskAmount are required and must pass a minimum 2:1 reward/risk check.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          requiredSchema: {
            direction: "long | short",
            timeframe: "string",
            riskReward: "number >= 2",
            confidence: "number 0-100",
            setupType: "string describing the setup archetype",
            thesis: "string",
            marketStructure: "string",
            liquidityAnalysis: "string",
            entryPlan: "string",
            stopPlan: "string",
            targetPlan: "string",
            invalidation: ["string"],
            entry: "number",
            stop: "number",
            target: "number",
            size: "integer",
            riskAmount: "number",
            timeframeAlignment: { Daily: "string", "4H": "string", "1H": "string" },
            session: "string",
            basis: "string",
          },
          context,
          learnedTradingFramework: knowledgeText.slice(0, 12000),
        }),
      },
    ],
    {
      lane: "finance",
      reasoningEffort: "high",
      temperature: 0.35,
      maxTokens: 1800,
    },
  );

  const parsed = extractJsonObject(response) as ModelTradeProposal;
  return normalizeModelProposal(input, parsed, knowledgeEntries.length, pricedFromReference);
}

async function generateRuleBasedTradeStrategy(
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

  const { direction, auto } = resolveDirection(input.directionPreference, knowledgeText, input.signal);

  const riskReward = roundRR(3.0);
  const confidence = scoreConfidence(knowledgeEntries.length, auto, input.signal, input.structureAnalysis);

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
    ? `ZAR built this proposal from ${knowledgeEntries.length} stored knowledge match(es) and its learned Trades By Sci framework. ${priceNote}`
    : `ZAR built this proposal from its learned Trades By Sci framework (no stored knowledge matched yet). ${priceNote}`;

  const strategy: GeneratedStrategy = {
    market: input.market,
    asset: input.asset,
    symbol,
    direction,
    timeframe,
    riskReward,
    confidence,
    setupType: inferSetupType(direction, input.signal, input.structureAnalysis),
    thesis: buildDataDrivenThesis(symbol, direction, levels, riskReward, input.signal),
    marketStructure: input.structureAnalysis ? buildEngineMarketStructure(input.structureAnalysis) : buildMarketStructure(direction, timeframe),
    liquidityAnalysis: input.structureAnalysis ? buildEngineLiquidityAnalysis(input.structureAnalysis) : buildLiquidityAnalysis(direction),
    entryPlan: buildEntryPlan(direction),
    stopPlan: buildStopPlan(direction),
    targetPlan: buildTargetPlan(direction),
    invalidation: buildInvalidation(direction).join("\n"),
    entry: levels.entry,
    stop: levels.stop,
    target: levels.target,
    size: levels.size,
    riskAmount: levels.riskAmount,
    timeframeAlignment: input.structureAnalysis
      ? Object.fromEntries(input.structureAnalysis.timeframes.map((t) => [t.timeframe, t.trend]))
      : buildTimeframeAlignment(timeframe, direction),
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
