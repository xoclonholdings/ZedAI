import { randomUUID } from "crypto";

import type {
  ConfluenceFactor,
  ConfluenceReport,
  FootprintKind,
  FootprintLifecycle,
  InstitutionalFootprint,
  LiquidityKind,
  LiquidityLevel,
  MarketStructureAnalysis,
  PriceInteraction,
  PriceInteractionKind,
  StructureAlert,
  StructureAlertType,
  StructureEvent,
  StructureEventKind,
  StructureTrend,
  SwingKind,
  SwingLabel,
  SwingPoint,
  TimeframeAlignmentReport,
  TimeframeStructure,
} from "../../../shared/market-structure-types";
import type { TradingSignal } from "../../../shared/trading-training-types";

import type { MarketBar } from "./MarketDataService";

/**
 * ZAR's Market Structure Engine.
 *
 * This is the reasoning layer that turns a plain series of OHLC bars into
 * the same vocabulary an experienced discretionary trader uses: swing
 * structure (HH/HL/LH/LL), structural breaks (BOS/CHoCH/MSS), liquidity
 * (equal highs/lows, pools, sweeps), institutional footprints (order
 * blocks, breakers, mitigation/rejection blocks, supply/demand zones,
 * fair value gaps), price interaction (retest/rejection/acceptance,
 * compression/expansion), multi-timeframe alignment, and a single
 * confluence score.
 *
 * Everything here is computed directly from bars — nothing is invented or
 * asked of an LLM. No function claims to know trader "intent"; liquidity
 * and footprints describe observable price behavior only (a level was
 * traded through and closed back inside it; a candle preceded an
 * impulsive move that broke structure). The explanation builder turns
 * these facts into plain language without requiring the reader to know
 * SMC/ICT terminology.
 */

const EQUAL_LEVEL_TOLERANCE_PCT = 0.0015; // ~0.15% treated as "equal" for liquidity clustering
const WICK_REJECTION_RATIO = 2; // wick at least 2x the candle body to count as a rejection

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function isBullishCandle(bar: MarketBar): boolean {
  return bar.c > bar.o;
}

function bodySize(bar: MarketBar): number {
  return Math.abs(bar.c - bar.o);
}

function nearlyEqual(a: number, b: number, tolerancePct = EQUAL_LEVEL_TOLERANCE_PCT): boolean {
  if (a === 0 || b === 0) return a === b;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= tolerancePct;
}

/* ----------------------------------------------------------------------
 * Swing structure
 * -------------------------------------------------------------------- */

/**
 * Fractal swing detection: a bar is a swing high when its high is the
 * strict local maximum over `strength` bars on each side (swing low is
 * the mirror image on lows). `strength` controls sensitivity — a larger
 * value finds fewer, more significant swings.
 */
export function detectSwings(bars: MarketBar[], strength: number, indexOffset = 0): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = strength; i < bars.length - strength; i++) {
    const bar = bars[i];
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= strength; k++) {
      if (bars[i - k].h >= bar.h || bars[i + k].h >= bar.h) isHigh = false;
      if (bars[i - k].l <= bar.l || bars[i + k].l <= bar.l) isLow = false;
    }
    if (isHigh) swings.push({ kind: "high", barIndex: i + indexOffset, price: bar.h, label: null });
    if (isLow) swings.push({ kind: "low", barIndex: i + indexOffset, price: bar.l, label: null });
  }
  return swings.sort((a, b) => a.barIndex - b.barIndex);
}

/** Label each swing HH/HL/LH/LL relative to the previous swing of the same kind. */
export function labelSwings(swings: SwingPoint[]): SwingPoint[] {
  let lastHigh: SwingPoint | null = null;
  let lastLow: SwingPoint | null = null;
  return swings.map((swing) => {
    if (swing.kind === "high") {
      const label: SwingLabel = !lastHigh || swing.price >= lastHigh.price ? "HH" : "LH";
      lastHigh = swing;
      return { ...swing, label };
    }
    const label: SwingLabel = !lastLow || swing.price >= lastLow.price ? "HL" : "LL";
    lastLow = swing;
    return { ...swing, label };
  });
}

/** Trend read from the most recent labeled high and low. */
export function classifyTrend(labeledSwings: SwingPoint[]): StructureTrend {
  const lastHigh = [...labeledSwings].reverse().find((s) => s.kind === "high");
  const lastLow = [...labeledSwings].reverse().find((s) => s.kind === "low");
  if (lastHigh?.label === "HH" && lastLow?.label === "HL") return "bullish";
  if (lastHigh?.label === "LH" && lastLow?.label === "LL") return "bearish";
  return "ranging";
}

/* ----------------------------------------------------------------------
 * Structural events: BOS / CHoCH / MSS
 * -------------------------------------------------------------------- */

/**
 * Walk the bars in order, tracking the prevailing trend. A close beyond
 * the most recent relevant swing in the direction of the prevailing
 * trend is a Break of Structure (continuation). A close beyond a swing
 * AGAINST the prevailing trend is a Change of Character (first sign of
 * reversal). If a second break confirms the new direction before any
 * opposite break occurs, that second break is additionally marked a
 * Market Structure Shift (a confirmed shift, not just a first warning).
 */
export function detectStructureEvents(bars: MarketBar[], labeledSwings: SwingPoint[]): StructureEvent[] {
  const events: StructureEvent[] = [];
  let trend: StructureTrend = "ranging";
  let mostRecentHigh: SwingPoint | null = null;
  let mostRecentLow: SwingPoint | null = null;
  let brokenHighIndices = new Set<number>();
  let brokenLowIndices = new Set<number>();
  let chochDirection: "bullish" | "bearish" | null = null;

  const swingsByIndex = new Map<number, SwingPoint[]>();
  for (const swing of labeledSwings) {
    const list = swingsByIndex.get(swing.barIndex) || [];
    list.push(swing);
    swingsByIndex.set(swing.barIndex, list);
  }

  for (let i = 0; i < bars.length; i++) {
    const atSwings = swingsByIndex.get(i) || [];
    for (const swing of atSwings) {
      if (swing.kind === "high") mostRecentHigh = swing;
      else mostRecentLow = swing;
    }

    const bar = bars[i];

    if (mostRecentHigh && !brokenHighIndices.has(mostRecentHigh.barIndex) && bar.c > mostRecentHigh.price) {
      const isContinuation = trend === "bullish" || trend === "ranging";
      const kind: StructureEventKind = isContinuation ? "BOS" : "CHoCH";
      events.push({
        kind,
        direction: "bullish",
        barIndex: i,
        brokenLevel: mostRecentHigh.price,
        brokenSwingBarIndex: mostRecentHigh.barIndex,
        description: isContinuation
          ? `Price closed above the prior swing high at ${round(mostRecentHigh.price, 2)}, continuing the existing structure.`
          : `Price closed above the prior swing high at ${round(mostRecentHigh.price, 2)}, breaking the bearish structure — the first sign of a shift to the upside.`,
      });
      brokenHighIndices.add(mostRecentHigh.barIndex);
      if (!isContinuation && chochDirection !== "bullish") {
        chochDirection = "bullish";
      } else if (chochDirection === "bullish") {
        events.push({
          kind: "MSS",
          direction: "bullish",
          barIndex: i,
          brokenLevel: mostRecentHigh.price,
          brokenSwingBarIndex: mostRecentHigh.barIndex,
          description: `A second bullish break confirmed the earlier change of character — market structure has shifted to bullish.`,
        });
        chochDirection = null;
      }
      trend = "bullish";
    } else if (mostRecentLow && !brokenLowIndices.has(mostRecentLow.barIndex) && bar.c < mostRecentLow.price) {
      const isContinuation = trend === "bearish" || trend === "ranging";
      const kind: StructureEventKind = isContinuation ? "BOS" : "CHoCH";
      events.push({
        kind,
        direction: "bearish",
        barIndex: i,
        brokenLevel: mostRecentLow.price,
        brokenSwingBarIndex: mostRecentLow.barIndex,
        description: isContinuation
          ? `Price closed below the prior swing low at ${round(mostRecentLow.price, 2)}, continuing the existing structure.`
          : `Price closed below the prior swing low at ${round(mostRecentLow.price, 2)}, breaking the bullish structure — the first sign of a shift to the downside.`,
      });
      brokenLowIndices.add(mostRecentLow.barIndex);
      if (!isContinuation && chochDirection !== "bearish") {
        chochDirection = "bearish";
      } else if (chochDirection === "bearish") {
        events.push({
          kind: "MSS",
          direction: "bearish",
          barIndex: i,
          brokenLevel: mostRecentLow.price,
          brokenSwingBarIndex: mostRecentLow.barIndex,
          description: `A second bearish break confirmed the earlier change of character — market structure has shifted to bearish.`,
        });
        chochDirection = null;
      }
      trend = "bearish";
    }
  }

  return events;
}

/* ----------------------------------------------------------------------
 * Liquidity
 * -------------------------------------------------------------------- */

/**
 * Builds resting-liquidity pools from swing highs/lows (buy-side above
 * highs, sell-side below lows), merges pools that sit at effectively the
 * same price into "equal highs/lows", and marks each pool swept the
 * first time price trades beyond it and closes back inside — a sweep is
 * an observation about price behavior, not a claim about who caused it.
 */
export function detectLiquidity(bars: MarketBar[], labeledSwings: SwingPoint[]): LiquidityLevel[] {
  const highs = labeledSwings.filter((s) => s.kind === "high");
  const lows = labeledSwings.filter((s) => s.kind === "low");

  function buildPools(swings: SwingPoint[], baseKind: LiquidityKind, equalKind: LiquidityKind): LiquidityLevel[] {
    const pools: LiquidityLevel[] = [];
    const used = new Set<number>();
    for (let i = 0; i < swings.length; i++) {
      if (used.has(i)) continue;
      const cluster = [swings[i]];
      used.add(i);
      for (let j = i + 1; j < swings.length; j++) {
        if (used.has(j)) continue;
        if (nearlyEqual(swings[i].price, swings[j].price)) {
          cluster.push(swings[j]);
          used.add(j);
        }
      }
      const avgPrice = round(cluster.reduce((sum, s) => sum + s.price, 0) / cluster.length, 4);
      pools.push({
        kind: cluster.length > 1 ? equalKind : baseKind,
        price: avgPrice,
        formedAtBarIndices: cluster.map((s) => s.barIndex),
        status: "active",
      });
    }
    return pools;
  }

  const pools = [
    ...buildPools(highs, "buy_side_pool", "equal_highs"),
    ...buildPools(lows, "sell_side_pool", "equal_lows"),
  ];

  for (const pool of pools) {
    const formedAt = Math.max(...pool.formedAtBarIndices);
    const isHighSide = pool.kind === "buy_side_pool" || pool.kind === "equal_highs";
    for (let i = formedAt + 1; i < bars.length; i++) {
      const bar = bars[i];
      if (isHighSide) {
        if (bar.h > pool.price && bar.c < pool.price) {
          pool.status = "swept";
          pool.sweptAtBarIndex = i;
          break;
        }
        if (bar.c > pool.price) break; // genuine break-through, not a sweep
      } else {
        if (bar.l < pool.price && bar.c > pool.price) {
          pool.status = "swept";
          pool.sweptAtBarIndex = i;
          break;
        }
        if (bar.c < pool.price) break;
      }
    }
  }

  return pools.sort((a, b) => Math.max(...a.formedAtBarIndices) - Math.max(...b.formedAtBarIndices));
}

/* ----------------------------------------------------------------------
 * Institutional footprints: order blocks, FVGs, breakers, mitigation,
 * rejection blocks, supply/demand zones.
 * -------------------------------------------------------------------- */

export function detectFairValueGaps(bars: MarketBar[]): InstitutionalFootprint[] {
  const gaps: InstitutionalFootprint[] = [];
  for (let i = 1; i < bars.length - 1; i++) {
    const prev = bars[i - 1];
    const next = bars[i + 1];
    if (prev.h < next.l) {
      gaps.push({
        kind: "fair_value_gap",
        direction: "bullish",
        high: next.l,
        low: prev.h,
        formedAtBarIndex: i,
        lifecycle: "fresh",
      });
    } else if (prev.l > next.h) {
      gaps.push({
        kind: "fair_value_gap",
        direction: "bearish",
        high: prev.l,
        low: next.h,
        formedAtBarIndex: i,
        lifecycle: "fresh",
      });
    }
  }
  return gaps;
}

/**
 * Order blocks form on the last opposite-colored candle before an
 * impulsive move that produces a structural break. Their lifecycle
 * (fresh → mitigated → invalidated, with an invalidated bullish OB
 * flipping into a bearish breaker block and vice versa) is tracked
 * forward from formation.
 */
export function detectOrderBlocksAndBreakers(bars: MarketBar[], events: StructureEvent[]): InstitutionalFootprint[] {
  const footprints: InstitutionalFootprint[] = [];

  for (const event of events) {
    if (event.kind === "MSS") continue; // MSS confirms a CHoCH already tagged; avoid duplicate OBs
    const breakIndex = event.barIndex;
    let obIndex = -1;
    for (let i = breakIndex - 1; i >= Math.max(0, breakIndex - 8); i--) {
      const wantsBearishCandle = event.direction === "bullish";
      if (wantsBearishCandle ? !isBullishCandle(bars[i]) : isBullishCandle(bars[i])) {
        obIndex = i;
        break;
      }
    }
    if (obIndex === -1) continue;
    const ob = bars[obIndex];
    const footprint: InstitutionalFootprint = {
      kind: event.direction === "bullish" ? "bullish_order_block" : "bearish_order_block",
      direction: event.direction,
      high: ob.h,
      low: ob.l,
      formedAtBarIndex: obIndex,
      lifecycle: "fresh",
    };

    for (let i = obIndex + 1; i < bars.length; i++) {
      const bar = bars[i];
      const overlaps = bar.l <= footprint.high && bar.h >= footprint.low;
      const invalidated =
        footprint.direction === "bullish" ? bar.c < footprint.low : bar.c > footprint.high;
      if (invalidated) {
        footprint.lifecycle = "invalidated";
        footprint.invalidatedAtBarIndex = i;
        footprints.push({
          kind: "breaker_block",
          direction: footprint.direction === "bullish" ? "bearish" : "bullish",
          high: footprint.high,
          low: footprint.low,
          formedAtBarIndex: i,
          lifecycle: "fresh",
        });
        break;
      }
      if (overlaps && footprint.lifecycle === "fresh") {
        footprint.lifecycle = "mitigated";
        footprint.mitigatedAtBarIndex = i;
      }
    }

    footprints.push(footprint);
  }

  return footprints;
}

/** A candle with a wick at least `WICK_REJECTION_RATIO`x its body, at a swing extreme. */
export function detectRejectionBlocks(bars: MarketBar[], labeledSwings: SwingPoint[]): InstitutionalFootprint[] {
  const rejections: InstitutionalFootprint[] = [];
  for (const swing of labeledSwings) {
    const bar = bars[swing.barIndex];
    if (!bar) continue;
    const body = Math.max(bodySize(bar), 0.0001);
    if (swing.kind === "high") {
      const upperWick = bar.h - Math.max(bar.o, bar.c);
      if (upperWick >= body * WICK_REJECTION_RATIO) {
        rejections.push({
          kind: "rejection_block",
          direction: "bearish",
          high: bar.h,
          low: Math.max(bar.o, bar.c),
          formedAtBarIndex: swing.barIndex,
          lifecycle: "fresh",
        });
      }
    } else {
      const lowerWick = Math.min(bar.o, bar.c) - bar.l;
      if (lowerWick >= body * WICK_REJECTION_RATIO) {
        rejections.push({
          kind: "rejection_block",
          direction: "bullish",
          high: Math.min(bar.o, bar.c),
          low: bar.l,
          formedAtBarIndex: swing.barIndex,
          lifecycle: "fresh",
        });
      }
    }
  }
  return rejections;
}

/** A short consolidation immediately before a strong impulsive leg — the origin of the move. */
export function detectSupplyDemandZones(bars: MarketBar[], events: StructureEvent[]): InstitutionalFootprint[] {
  const zones: InstitutionalFootprint[] = [];
  const consolidationBars = 3;
  for (const event of events) {
    const start = event.barIndex - consolidationBars - 1;
    const end = event.barIndex - 1;
    if (start < 0 || end < start) continue;
    const window = bars.slice(start, end + 1);
    if (window.length < 2) continue;
    const high = Math.max(...window.map((b) => b.h));
    const low = Math.min(...window.map((b) => b.l));
    const range = high - low;
    const avgRange =
      window.reduce((sum, b) => sum + (b.h - b.l), 0) / window.length || 1;
    if (range > avgRange * 2.5) continue; // not actually a tight consolidation
    zones.push({
      kind: event.direction === "bullish" ? "demand_zone" : "supply_zone",
      direction: event.direction,
      high,
      low,
      formedAtBarIndex: end,
      lifecycle: "fresh",
    });
  }
  return zones;
}

/* ----------------------------------------------------------------------
 * Price interaction
 * -------------------------------------------------------------------- */

export function detectPriceInteractions(bars: MarketBar[], events: StructureEvent[]): PriceInteraction[] {
  const interactions: PriceInteraction[] = [];
  const window = 10;

  for (let i = window; i < bars.length; i++) {
    const recent = bars.slice(i - window, i);
    const prior = bars.slice(Math.max(0, i - window * 2), i - window);
    if (prior.length < window) continue;
    const recentRange = Math.max(...recent.map((b) => b.h)) - Math.min(...recent.map((b) => b.l));
    const priorRange = Math.max(...prior.map((b) => b.h)) - Math.min(...prior.map((b) => b.l));
    if (priorRange <= 0) continue;
    const ratio = recentRange / priorRange;
    if (ratio < 0.55 && i === bars.length - 1) {
      interactions.push({ kind: "compression", barIndex: i, detail: `Range has compressed to ${Math.round(ratio * 100)}% of the prior window — a squeeze often precedes an expansion.` });
    } else if (ratio > 1.8 && i === bars.length - 1) {
      interactions.push({ kind: "expansion", barIndex: i, detail: `Range has expanded to ${Math.round(ratio * 100)}% of the prior window — an impulsive move is underway.` });
    }
  }

  // Overlap ratio over the most recent window for consolidation.
  if (bars.length >= window) {
    const recent = bars.slice(-window);
    let overlapCount = 0;
    for (let i = 1; i < recent.length; i++) {
      const overlaps = recent[i].l <= recent[i - 1].h && recent[i].h >= recent[i - 1].l;
      if (overlaps) overlapCount++;
    }
    if (overlapCount / (recent.length - 1) > 0.7) {
      interactions.push({
        kind: "consolidation",
        barIndex: bars.length - 1,
        detail: "Recent bars are overlapping heavily — price is consolidating rather than trending.",
      });
    }
  }

  // Retest / rejection / acceptance after each structural break.
  for (const event of events) {
    const level = event.brokenLevel;
    const lookahead = bars.slice(event.barIndex + 1, event.barIndex + 15);
    for (let offset = 0; offset < lookahead.length; offset++) {
      const bar = lookahead[offset];
      const touched = event.direction === "bullish" ? bar.l <= level : bar.h >= level;
      if (!touched) continue;
      const held = event.direction === "bullish" ? bar.c >= level : bar.c <= level;
      const idx = event.barIndex + 1 + offset;
      if (held) {
        interactions.push({ kind: "retest", barIndex: idx, detail: `Price returned to retest the broken level near ${round(level, 2)} and held.` });
        interactions.push({ kind: "acceptance", barIndex: idx, detail: `The retest closed on the breakout side of ${round(level, 2)} — the level is being accepted as the new support/resistance.` });
      } else {
        interactions.push({ kind: "rejection", barIndex: idx, detail: `Price returned toward ${round(level, 2)} and was rejected back through it, weakening the break.` });
      }
      break;
    }
  }

  // Impulsive vs corrective legs between consecutive events.
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const next = events[i + 1];
    const legEnd = next ? next.barIndex : bars.length - 1;
    const legBars = bars.slice(event.barIndex, Math.min(legEnd + 1, bars.length));
    if (legBars.length < 2) continue;
    const displacement = Math.abs(legBars[legBars.length - 1].c - legBars[0].o);
    const totalRange = legBars.reduce((sum, b) => sum + (b.h - b.l), 0) || 1;
    const efficiency = displacement / totalRange;
    interactions.push({
      kind: efficiency > 0.45 ? "impulsive_move" : "corrective_move",
      barIndex: event.barIndex,
      detail:
        efficiency > 0.45
          ? "The move away from this break was efficient and directional — an impulsive leg."
          : "The move away from this break was choppy relative to its range — a corrective leg.",
    });
  }

  return interactions;
}

/* ----------------------------------------------------------------------
 * Per-timeframe orchestration
 * -------------------------------------------------------------------- */

export function analyzeTimeframe(bars: MarketBar[], timeframe: string): TimeframeStructure | null {
  if (bars.length < 12) return null;

  const externalSwingsRaw = detectSwings(bars, Math.max(3, Math.floor(bars.length / 40) + 2));
  const externalSwings = labelSwings(externalSwingsRaw);

  const internalWindowSize = Math.min(60, bars.length);
  const internalOffset = bars.length - internalWindowSize;
  const internalSwingsRaw = detectSwings(bars.slice(internalOffset), 2, internalOffset);
  const internalSwings = labelSwings(internalSwingsRaw);

  const events = detectStructureEvents(bars, externalSwings);
  const liquidity = detectLiquidity(bars, externalSwings);
  const footprints = [
    ...detectOrderBlocksAndBreakers(bars, events),
    ...detectFairValueGaps(bars),
    ...detectRejectionBlocks(bars, externalSwings),
    ...detectSupplyDemandZones(bars, events),
  ];
  const interactions = detectPriceInteractions(bars, events);

  return {
    timeframe,
    barsAnalyzed: bars.length,
    trend: classifyTrend(externalSwings),
    externalStructure: classifyTrend(externalSwings),
    internalStructure: classifyTrend(internalSwings),
    swings: externalSwings,
    events,
    liquidity,
    footprints,
    interactions,
    lastClose: bars[bars.length - 1].c,
  };
}

/* ----------------------------------------------------------------------
 * Multi-timeframe alignment
 * -------------------------------------------------------------------- */

export function analyzeTimeframeAlignment(
  timeframes: TimeframeStructure[],
  primaryTimeframe: string,
): TimeframeAlignmentReport {
  const primary = timeframes.find((t) => t.timeframe === primaryTimeframe) || timeframes[0];
  if (!primary) {
    return { agreementScore: 0, agreeing: [], disagreeing: [], summary: "Not enough timeframes to compare." };
  }
  const others = timeframes.filter((t) => t.timeframe !== primary.timeframe);
  const agreeing = others.filter((t) => t.trend === primary.trend).map((t) => t.timeframe);
  const disagreeing = others.filter((t) => t.trend !== primary.trend).map((t) => t.timeframe);
  const total = others.length || 1;
  const agreementScore = Math.round((agreeing.length / total) * 100);

  let summary: string;
  if (!others.length) {
    summary = `Only ${primary.timeframe} was analyzed — no higher-timeframe context to confirm or contradict it.`;
  } else if (agreementScore === 100) {
    summary = `Every analyzed timeframe (${[primary.timeframe, ...agreeing].join(", ")}) agrees on a ${primary.trend} bias.`;
  } else if (agreementScore === 0) {
    summary = `${primary.timeframe} (${primary.trend}) disagrees with every other analyzed timeframe (${disagreeing.join(", ")}) — treat this setup with caution.`;
  } else {
    summary = `${primary.timeframe} is ${primary.trend}, agreeing with ${agreeing.join(", ") || "none"} but disagreeing with ${disagreeing.join(", ")}.`;
  }

  return { agreementScore, agreeing, disagreeing, summary };
}

/* ----------------------------------------------------------------------
 * Confluence scoring
 * -------------------------------------------------------------------- */

export function scoreConfluence(
  timeframes: TimeframeStructure[],
  alignment: TimeframeAlignmentReport,
  primaryTimeframe: string,
  signal?: TradingSignal | null,
): ConfluenceReport {
  const primary = timeframes.find((t) => t.timeframe === primaryTimeframe) || timeframes[0];
  const factors: ConfluenceFactor[] = [];

  function add(name: string, weight: number, contribution: number, detail: string) {
    factors.push({ name, weight, contribution: Math.max(0, Math.min(weight, contribution)), detail });
  }

  if (primary) {
    const recentEvent = [...primary.events].reverse()[0];
    add(
      "Structure",
      20,
      recentEvent ? (recentEvent.kind === "MSS" ? 20 : recentEvent.kind === "CHoCH" ? 14 : 12) : 0,
      recentEvent ? `Most recent structural event: ${recentEvent.kind} (${recentEvent.direction}).` : "No recent structural break detected.",
    );

    const activeSweep = [...primary.liquidity].reverse().find((l) => l.status === "swept");
    add(
      "Liquidity",
      15,
      activeSweep ? 15 : 0,
      activeSweep ? `A ${activeSweep.kind.replace(/_/g, " ")} near ${round(activeSweep.price, 2)} was swept.` : "No recent liquidity sweep detected.",
    );

    const freshOrMitigatedOB = primary.footprints.find(
      (f) => (f.kind === "bullish_order_block" || f.kind === "bearish_order_block") && f.lifecycle !== "invalidated",
    );
    add(
      "Order block",
      15,
      freshOrMitigatedOB ? (freshOrMitigatedOB.lifecycle === "fresh" ? 15 : 10) : 0,
      freshOrMitigatedOB
        ? `An unmitigated-to-partially-tested ${freshOrMitigatedOB.direction} order block is in play (${freshOrMitigatedOB.lifecycle}).`
        : "No live order block in play.",
    );

    const freshFvg = primary.footprints.find((f) => f.kind === "fair_value_gap" && f.lifecycle === "fresh");
    add(
      "Imbalance",
      10,
      freshFvg ? 10 : 0,
      freshFvg ? `An unfilled ${freshFvg.direction} fair value gap remains open.` : "No unfilled imbalance detected.",
    );

    const recentInteraction = [...primary.interactions].reverse().find((i) => i.kind === "acceptance" || i.kind === "impulsive_move");
    add(
      "Price interaction",
      10,
      recentInteraction ? 10 : 3,
      recentInteraction ? recentInteraction.detail : "No strong acceptance or impulsive move recently confirmed.",
    );
  }

  add(
    "Higher-timeframe alignment",
    20,
    Math.round((alignment.agreementScore / 100) * 20),
    alignment.summary,
  );

  if (signal && signal.signal !== "neutral") {
    add(
      "Technical indicators",
      10,
      Math.round((signal.strength / 100) * 10),
      signal.summary,
    );
  } else {
    add("Technical indicators", 10, 0, "No confirming indicator signal available.");
  }

  const score = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));
  return { score: Math.max(0, Math.min(100, score)), factors };
}

/* ----------------------------------------------------------------------
 * Explanation + setup tagging
 * -------------------------------------------------------------------- */

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

const DIRECTIONAL_FOOTPRINT_KINDS = new Set<FootprintKind>([
  "bullish_order_block",
  "bearish_order_block",
  "supply_zone",
  "demand_zone",
]);

function describeFootprint(footprint: InstitutionalFootprint): string {
  const label = footprint.kind.replace(/_/g, " ");
  const withDirection = DIRECTIONAL_FOOTPRINT_KINDS.has(footprint.kind) ? label : `${footprint.direction} ${label}`;
  return `${article(footprint.lifecycle)} ${footprint.lifecycle} ${withDirection} near ${round((footprint.high + footprint.low) / 2, 2)}`;
}

export function explainMarketStructure(
  symbol: string,
  timeframes: TimeframeStructure[],
  alignment: TimeframeAlignmentReport,
  confluence: ConfluenceReport,
  primaryTimeframe: string,
): string {
  const primary = timeframes.find((t) => t.timeframe === primaryTimeframe) || timeframes[0];
  if (!primary) return `Not enough price history was available to read ${symbol}'s market structure.`;

  const sentences: string[] = [];

  const recentSweep = [...primary.liquidity].reverse().find((l) => l.status === "swept");
  const recentEvent = [...primary.events].reverse()[0];
  const liveFootprint = primary.footprints.find(
    (f) => (f.kind === "bullish_order_block" || f.kind === "bearish_order_block") && f.lifecycle !== "invalidated",
  );

  if (recentSweep) {
    sentences.push(
      `Price swept the ${recentSweep.kind.replace(/_/g, " ")} resting near ${round(recentSweep.price, 2)} before ${recentEvent && recentEvent.direction === "bullish" ? "reclaiming" : "losing"} the level that mattered.`,
    );
  }

  if (recentEvent) {
    sentences.push(
      recentEvent.kind === "BOS"
        ? `${primary.timeframe} structure just confirmed a ${recentEvent.direction} continuation (break of structure) through ${round(recentEvent.brokenLevel, 2)}.`
        : `${primary.timeframe} structure just registered a ${recentEvent.kind === "MSS" ? "confirmed shift" : "change of character"} to the ${recentEvent.direction} side through ${round(recentEvent.brokenLevel, 2)}.`,
    );
  } else {
    sentences.push(`${primary.timeframe} hasn't produced a clean structural break recently — the range is still developing.`);
  }

  if (liveFootprint) {
    sentences.push(`The reaction is happening inside ${describeFootprint(liveFootprint)}.`);
  }

  sentences.push(alignment.summary);

  const scoreWord = confluence.score >= 70 ? "high" : confluence.score >= 45 ? "moderate" : "low";
  sentences.push(`Combining structure, liquidity, and timeframe context, this reads as ${scoreWord} confluence (${confluence.score}/100).`);

  return sentences.join(" ");
}

export function buildSetupTag(timeframes: TimeframeStructure[], primaryTimeframe: string): string {
  const primary = timeframes.find((t) => t.timeframe === primaryTimeframe) || timeframes[0];
  if (!primary) return "unclassified_setup";
  const parts: string[] = [];
  const sweep = [...primary.liquidity].reverse().find((l) => l.status === "swept");
  if (sweep) parts.push("sweep");
  const event = [...primary.events].reverse()[0];
  if (event) parts.push(event.kind.toLowerCase());
  const ob = primary.footprints.find((f) => f.kind === "bullish_order_block" || f.kind === "bearish_order_block");
  if (ob) parts.push(ob.direction === "bullish" ? "bullish_ob" : "bearish_ob");
  const fvg = primary.footprints.find((f) => f.kind === "fair_value_gap" && f.lifecycle === "fresh");
  if (fvg) parts.push("fvg");
  return parts.length ? parts.join("_") : `${primary.trend}_structure`;
}

/* ----------------------------------------------------------------------
 * Top-level orchestration
 * -------------------------------------------------------------------- */

export interface TimeframeSeries {
  timeframe: string;
  bars: MarketBar[];
}

export function analyzeMarketStructure(
  symbol: string,
  series: TimeframeSeries[],
  primaryTimeframe: string,
  signal?: TradingSignal | null,
): MarketStructureAnalysis | null {
  const timeframes = series
    .map((s) => analyzeTimeframe(s.bars, s.timeframe))
    .filter((t): t is TimeframeStructure => t !== null);

  if (!timeframes.length) return null;

  const effectivePrimary = timeframes.find((t) => t.timeframe === primaryTimeframe) ? primaryTimeframe : timeframes[0].timeframe;
  const alignment = analyzeTimeframeAlignment(timeframes, effectivePrimary);
  const confluence = scoreConfluence(timeframes, alignment, effectivePrimary, signal);
  const explanation = explainMarketStructure(symbol, timeframes, alignment, confluence, effectivePrimary);
  const setupTag = buildSetupTag(timeframes, effectivePrimary);

  return {
    symbol: symbol.toUpperCase(),
    generatedAt: new Date().toISOString(),
    primaryTimeframe: effectivePrimary,
    timeframes,
    alignment,
    confluence,
    explanation,
    setupTag,
  };
}

/* ----------------------------------------------------------------------
 * Alerts
 * -------------------------------------------------------------------- */

/**
 * Diffs a fresh analysis against the last one stored for this symbol and
 * produces intelligent, low-frequency alerts — context over noise. Only
 * genuinely new developments fire; re-detecting the same sweep or event
 * on every poll does not.
 */
export function generateStructureAlerts(
  userId: string,
  current: MarketStructureAnalysis,
  previous: MarketStructureAnalysis | null,
): StructureAlert[] {
  const alerts: StructureAlert[] = [];
  const primary = current.timeframes.find((t) => t.timeframe === current.primaryTimeframe) || current.timeframes[0];
  if (!primary) return alerts;

  function push(type: StructureAlertType, message: string) {
    alerts.push({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      userId,
      symbol: current.symbol,
      type,
      message,
      confluence: current.confluence.score,
    });
  }

  const prevPrimary = previous?.timeframes.find((t) => t.timeframe === current.primaryTimeframe);
  const prevLatestEventIndex = prevPrimary ? [...prevPrimary.events].reverse()[0]?.barIndex ?? -1 : -1;
  const latestEvent = [...primary.events].reverse()[0];
  if (latestEvent && latestEvent.barIndex > prevLatestEventIndex) {
    if (latestEvent.kind === "CHoCH" || latestEvent.kind === "MSS") {
      push(
        latestEvent.kind === "MSS" ? "trend_reversal" : "structure_shift",
        `${current.symbol}: ${latestEvent.kind === "MSS" ? "Confirmed trend reversal" : "Change of character"} to ${latestEvent.direction} on ${current.primaryTimeframe}.`,
      );
    }
  }

  const prevSweptPrices = new Set((prevPrimary?.liquidity || []).filter((l) => l.status === "swept").map((l) => l.price));
  const newSweep = primary.liquidity.find((l) => l.status === "swept" && !prevSweptPrices.has(l.price));
  if (newSweep) {
    push("liquidity_sweep", `${current.symbol}: Liquidity swept near ${round(newSweep.price, 2)} (${newSweep.kind.replace(/_/g, " ")}).`);
  }

  if (current.confluence.score >= 75 && (previous?.confluence.score ?? 0) < 75) {
    push("high_confluence_zone", `${current.symbol}: Confluence reached ${current.confluence.score}/100 — ${current.explanation}`);
  }

  const testedOB = primary.footprints.find(
    (f) =>
      (f.kind === "bullish_order_block" || f.kind === "bearish_order_block") &&
      f.mitigatedAtBarIndex !== undefined &&
      f.mitigatedAtBarIndex === primary.barsAnalyzed - 1,
  );
  if (testedOB) {
    push("major_order_block_test", `${current.symbol}: Price is testing a ${testedOB.direction} order block near ${round((testedOB.high + testedOB.low) / 2, 2)}.`);
  }

  if (current.alignment.agreementScore === 100 && (previous?.alignment.agreementScore ?? 0) < 100 && current.timeframes.length > 1) {
    push("multi_timeframe_alignment", `${current.symbol}: All analyzed timeframes now agree on a ${primary.trend} bias.`);
  }

  return alerts;
}
