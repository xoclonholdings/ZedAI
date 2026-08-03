/**
 * Market structure reasoning types — the vocabulary ZAR's Market
 * Structure Engine uses internally to describe price behavior (swing
 * structure, liquidity, institutional footprints, price interaction,
 * multi-timeframe alignment, and confluence).
 *
 * These are internal reasoning artifacts, not user-facing labels. The
 * engine that produces them is also responsible for translating them
 * into plain language (see `MarketStructureAnalysis.explanation`) — the
 * raw structured facts exist so strategy generation, governance, and
 * learning can reason over evidence instead of free text.
 */

export type StructureTrend = "bullish" | "bearish" | "ranging";

export type SwingKind = "high" | "low";

/** Relative to the previous swing of the same kind. */
export type SwingLabel = "HH" | "HL" | "LH" | "LL";

export interface SwingPoint {
  kind: SwingKind;
  /** Index into the bar array this swing formed at. */
  barIndex: number;
  price: number;
  /** null until there is a prior same-kind swing to compare against. */
  label: SwingLabel | null;
}

export type StructureEventKind = "BOS" | "CHoCH" | "MSS";

export interface StructureEvent {
  kind: StructureEventKind;
  direction: "bullish" | "bearish";
  barIndex: number;
  /** The swing level that was broken to produce this event. */
  brokenLevel: number;
  brokenSwingBarIndex: number;
  description: string;
}

export type LiquidityKind =
  | "buy_side_pool"
  | "sell_side_pool"
  | "equal_highs"
  | "equal_lows";

export interface LiquidityLevel {
  kind: LiquidityKind;
  price: number;
  /** Bar indices whose swing points formed/touched this level. */
  formedAtBarIndices: number[];
  status: "active" | "swept";
  /** Set once price has traded through and closed back inside the level. */
  sweptAtBarIndex?: number;
}

export type FootprintKind =
  | "bullish_order_block"
  | "bearish_order_block"
  | "breaker_block"
  | "mitigation_block"
  | "rejection_block"
  | "supply_zone"
  | "demand_zone"
  | "fair_value_gap";

export type FootprintLifecycle = "fresh" | "mitigated" | "invalidated" | "broken";

export interface InstitutionalFootprint {
  kind: FootprintKind;
  direction: "bullish" | "bearish";
  high: number;
  low: number;
  formedAtBarIndex: number;
  lifecycle: FootprintLifecycle;
  mitigatedAtBarIndex?: number;
  invalidatedAtBarIndex?: number;
}

export type PriceInteractionKind =
  | "retest"
  | "rejection"
  | "acceptance"
  | "compression"
  | "expansion"
  | "consolidation"
  | "impulsive_move"
  | "corrective_move";

export interface PriceInteraction {
  kind: PriceInteractionKind;
  barIndex: number;
  detail: string;
}

export interface TimeframeStructure {
  timeframe: string;
  barsAnalyzed: number;
  trend: StructureTrend;
  /** Structure formed over the whole analyzed window. */
  externalStructure: StructureTrend;
  /** Structure formed over the most recent, shorter lookback. */
  internalStructure: StructureTrend;
  swings: SwingPoint[];
  events: StructureEvent[];
  liquidity: LiquidityLevel[];
  footprints: InstitutionalFootprint[];
  interactions: PriceInteraction[];
  lastClose: number;
}

export interface TimeframeAlignmentReport {
  /** 0-100: share of analyzed timeframes agreeing with the primary timeframe's trend. */
  agreementScore: number;
  agreeing: string[];
  disagreeing: string[];
  summary: string;
}

export interface ConfluenceFactor {
  name: string;
  /** How much this factor could contribute, at most. */
  weight: number;
  /** How much it actually contributed (0 to weight). */
  contribution: number;
  detail: string;
}

export interface ConfluenceReport {
  score: number;
  factors: ConfluenceFactor[];
}

export type StructureAlertType =
  | "structure_shift"
  | "liquidity_sweep"
  | "high_confluence_zone"
  | "major_order_block_test"
  | "trend_reversal"
  | "multi_timeframe_alignment";

export interface StructureAlert {
  id: string;
  createdAt: string;
  userId: string;
  symbol: string;
  type: StructureAlertType;
  message: string;
  confluence: number;
}

export interface MarketStructureAnalysis {
  symbol: string;
  generatedAt: string;
  primaryTimeframe: string;
  timeframes: TimeframeStructure[];
  alignment: TimeframeAlignmentReport;
  confluence: ConfluenceReport;
  /** Plain-language synthesis of everything above — no SMC/ICT jargon required to understand it. */
  explanation: string;
  /** Short structured tag for learning/analytics, e.g. "sweep_bullish_ob_reclaim". */
  setupTag: string;
}

/** Aggregate, outcome-based learning stats the engine's setup tags feed into. */
export interface StructureLearningStats {
  sweepSuccessRate: number | null;
  orderBlockPerformance: number | null;
  fairValueGapFillRate: number | null;
  structuralContinuationRate: number | null;
  reversalFrequency: number | null;
  bestConfluenceCombinations: string[];
  worstConfluenceCombinations: string[];
  mostReliableTimeframes: string[];
  leastReliableTimeframes: string[];
  sampleSize: number;
}
