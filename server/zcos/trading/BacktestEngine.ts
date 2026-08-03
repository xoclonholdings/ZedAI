import type { TradingAssetClass } from "../../../shared/trading-types";
import type { BacktestReport } from "../../../shared/trading-training-types";

import { getHistoricalBars, type MarketBar } from "./MarketDataService";
import { averageTrueRange } from "./MarketDataService";
import { computeSignal } from "./TechnicalIndicators";
import { resolveAgainstRange } from "./TradeAutoResolver";

/**
 * Backtests ZAR's signal-driven strategy over historical daily bars.
 *
 * Walks the price history bar by bar. At each bar (when flat) it computes
 * the exact same technical signal ZAR trades live from the data available
 * up to that bar — no look-ahead. On a strong enough signal it enters at
 * the close, sets an ATR stop and an R-multiple target, then resolves the
 * trade against the following bars' intraday high/low (the same rule the
 * live resolver uses) until it hits or times out. Results are reported in
 * R-multiples so the edge is capital-agnostic.
 *
 * This proves — or disproves — the strategy fast over real history instead
 * of waiting for a slow forward paper-trade sample.
 */

export interface BacktestInput {
  symbol: string;
  asset: TradingAssetClass;
  range?: string;
  riskReward?: number;
  signalThreshold?: number;
  maxHoldBars?: number;
  /** Slippage per fill in basis points of price (default 5 = 0.05%). */
  slippageBps?: number;
  /** Flat commission per trade expressed in R (default 0.02R). */
  commissionR?: number;
}

const WARMUP = 60; // bars needed before indicators are valid (SMA50/MACD)

export async function runBacktest(input: BacktestInput): Promise<BacktestReport | null> {
  const { bars, dates, source } = await getHistoricalBars(
    input.symbol,
    input.asset,
    input.range || "2y",
  );
  return backtestOverBars(input.symbol, bars, dates, source, input);
}

/** Pure backtest walk over supplied bars — exported for testing. */
export function backtestOverBars(
  symbol: string,
  bars: MarketBar[],
  dates: string[],
  source: string,
  input: Pick<
    BacktestInput,
    "riskReward" | "signalThreshold" | "maxHoldBars" | "asset" | "slippageBps" | "commissionR"
  >,
): BacktestReport | null {
  const riskReward = input.riskReward && input.riskReward >= 1 ? input.riskReward : 3;
  const signalThreshold = input.signalThreshold ?? 40;
  const maxHoldBars = input.maxHoldBars ?? 20;
  const slippageBps = input.slippageBps ?? 5;
  const commissionR = input.commissionR ?? 0.02;
  if (bars.length < WARMUP + 20) return null;

  const rMultiples: number[] = []; // net of costs
  let grossSum = 0;
  let costSum = 0;
  let wins = 0;
  let losses = 0;
  let timeouts = 0;
  let holdSum = 0;

  let i = WARMUP;
  while (i < bars.length - 1) {
    const history = bars.slice(0, i + 1);
    const signal = computeSignal(history);
    if (!signal || signal.signal === "neutral" || signal.strength < signalThreshold) {
      i++;
      continue;
    }
    const direction: "long" | "short" = signal.signal === "buy" ? "long" : "short";
    const entry = bars[i].c;
    const atr = averageTrueRange(history) ?? entry * 0.01;
    const riskDist = Math.max(atr, entry * 0.001);
    const stop = direction === "long" ? entry - riskDist : entry + riskDist;
    const target = direction === "long" ? entry + riskReward * riskDist : entry - riskReward * riskDist;

    // Round-trip cost in R: slippage on entry + exit (bps of price) plus a
    // flat commission. Subtracted from every trade so the edge is honest.
    const slipR = (2 * entry * (slippageBps / 10000)) / riskDist;
    const costR = slipR + commissionR;

    // A trade counts as a win/loss by its NET (post-cost) result, uniformly
    // across every exit path — previously the level-hit path counted wins
    // by the raw gross outcome while the timeout path counted by net,
    // which mixed two different definitions of "win" in the same winRate.
    const record = (grossR: number, isTimeout: boolean, held: number) => {
      const net = grossR - costR;
      rMultiples.push(net);
      grossSum += grossR;
      costSum += costR;
      if (net > 0) wins++;
      else losses++;
      if (isTimeout) timeouts++;
      holdSum += held;
    };

    // Resolve against the following bars.
    let resolved = false;
    for (let j = i + 1; j < Math.min(i + 1 + maxHoldBars, bars.length); j++) {
      const hit = resolveAgainstRange(direction, stop, target, bars[j].h, bars[j].l);
      if (hit) {
        record(hit.outcome === "win" ? riskReward : -1, false, j - i);
        i = j + 1;
        resolved = true;
        break;
      }
    }
    if (!resolved) {
      // Timed out — close at the last available bar's close.
      const exitIdx = Math.min(i + maxHoldBars, bars.length - 1);
      const exit = bars[exitIdx].c;
      const r = (direction === "long" ? exit - entry : entry - exit) / riskDist;
      record(r, true, exitIdx - i);
      i = exitIdx + 1;
    }
  }

  const totalTrades = rMultiples.length;
  if (totalTrades === 0) return null;

  const netR = round2(rMultiples.reduce((a, b) => a + b, 0));
  const expectancyR = round2(netR / totalTrades);
  const grossExpectancyR = round2(grossSum / totalTrades);
  const costPerTradeR = round2(costSum / totalTrades);
  // Profit factor is conventionally net-of-costs (matches TradingStore's
  // own calculateProfitFactor) — named net*, not gross*, since these sum
  // rMultiples (already net of costR), not the pre-cost grossR values.
  const netWin = rMultiples.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const netLoss = Math.abs(rMultiples.filter((r) => r < 0).reduce((a, b) => a + b, 0));
  const profitFactor = netLoss > 0 ? round2(netWin / netLoss) : netWin > 0 ? 99 : 0;
  const winRate = round2((wins / totalTrades) * 100);

  // Max drawdown in R across the equity curve.
  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  for (const r of rMultiples) {
    equity += r;
    peak = Math.max(peak, equity);
    maxDD = Math.max(maxDD, peak - equity);
  }

  const edge: BacktestReport["edge"] = expectancyR > 0.05 ? "positive" : expectancyR < -0.05 ? "negative" : "flat";
  const costNote = `after ${costPerTradeR}R/trade costs (gross ${grossExpectancyR}R)`;
  const summary =
    edge === "positive"
      ? `Positive edge: ${expectancyR}R per trade ${costNote} over ${totalTrades} trades (${winRate}% win, PF ${profitFactor}). Net ${netR}R, worst drawdown ${round2(maxDD)}R.`
      : edge === "negative"
        ? `No edge: ${expectancyR}R per trade ${costNote} over ${totalTrades} trades (${winRate}% win). This strategy loses on ${symbol.toUpperCase()} history — do not trade it as-is.`
        : `Flat: ${expectancyR}R per trade ${costNote} over ${totalTrades} trades. No meaningful edge on ${symbol.toUpperCase()} history.`;

  return {
    symbol: symbol.toUpperCase(),
    source,
    fromDate: dates[WARMUP] || "",
    toDate: dates[dates.length - 1] || "",
    barsTested: bars.length - WARMUP,
    totalTrades,
    wins,
    losses,
    timeouts,
    winRate,
    expectancyR,
    grossExpectancyR,
    costPerTradeR,
    slippageBps,
    commissionR,
    netR,
    profitFactor,
    maxDrawdownR: round2(maxDD),
    avgHoldBars: round2(holdSum / totalTrades),
    riskReward,
    signalThreshold,
    edge,
    summary,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type { MarketBar };
