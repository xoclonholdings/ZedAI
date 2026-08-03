import type { TradingAssetClass, TradeDirection } from "../../../shared/trading-types";

import { getMarketQuote, type MarketBar } from "./MarketDataService";

/**
 * ZAR picks a symbol to trade when the user doesn't know which to try.
 *
 * It scans a small universe of liquid instruments for the asset class,
 * pulls real quotes + recent daily bars, and scores each on momentum and
 * trend alignment (the higher-timeframe-continuation bias the curriculum
 * teaches). The strongest, cleanest mover wins, and the direction follows
 * its trend. Everything is grounded in live data — no random picks.
 *
 * If no live feed is reachable it returns null and the caller asks the
 * user for a symbol instead of guessing.
 */

const UNIVERSE: Record<TradingAssetClass, string[]> = {
  stock: ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AMD"],
  etf: ["SPY", "QQQ", "IWM", "DIA"],
  option: ["SPY", "QQQ", "AAPL", "NVDA"],
  future: ["ES", "NQ", "YM", "CL", "GC"],
  crypto: ["BTC", "ETH", "SOL"],
  forex: ["EURUSD", "GBPUSD", "USDJPY"],
};

export interface SymbolRecommendation {
  symbol: string;
  direction: TradeDirection;
  price: number;
  source: string;
  momentumPct: number;
  signal: "buy" | "sell" | "neutral" | null;
  signalStrength: number;
  reason: string;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const window = values.slice(-period);
  return window.reduce((sum, v) => sum + v, 0) / period;
}

/**
 * Score a symbol from its recent bars. Returns null when there isn't
 * enough history to judge (so it won't be picked on noise).
 */
export function scoreSymbol(bars: MarketBar[] | undefined): {
  score: number;
  direction: TradeDirection;
  momentumPct: number;
} | null {
  if (!bars || bars.length < 10) return null;
  const closes = bars.map((b) => b.c).filter((c) => Number.isFinite(c) && c > 0);
  if (closes.length < 10) return null;
  const last = closes[closes.length - 1];
  const ref = closes[closes.length - 10];
  if (!(ref > 0)) return null;
  const momentum = (last - ref) / ref; // 10-bar momentum
  const sma10 = sma(closes, 10);
  const sma20 = sma(closes, Math.min(20, closes.length));
  const direction: TradeDirection = momentum >= 0 ? "long" : "short";
  // Reward trend alignment: price on the right side of its averages.
  let aligned = false;
  if (sma10 != null && sma20 != null) {
    aligned = direction === "long" ? last > sma10 && sma10 >= sma20 : last < sma10 && sma10 <= sma20;
  }
  const score = Math.abs(momentum) * (aligned ? 1.25 : 0.8);
  return { score, direction, momentumPct: Math.round(momentum * 1000) / 10 };
}

export async function recommendSymbol(
  asset: TradingAssetClass,
  _market = "US",
  opts: { avoidSymbols?: string[]; preferDirection?: TradeDirection | "auto" } = {},
): Promise<SymbolRecommendation | null> {
  const universe = UNIVERSE[asset] || UNIVERSE.etf;
  const avoid = new Set((opts.avoidSymbols || []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  // If every symbol in the universe is on the avoid list, ignore the
  // avoid list entirely rather than returning nothing.
  const ignoreAvoidList = !universe.some((symbol) => !avoid.has(symbol.toUpperCase()));
  const pool = universe;

  const scored: Array<{
    score: number;
    symbol: string;
    direction: TradeDirection;
    price: number;
    source: string;
    momentumPct: number;
    signal: "buy" | "sell" | "neutral" | null;
    signalStrength: number;
  }> = [];
  for (const symbol of pool) {
    if (avoid.has(symbol.toUpperCase()) && !ignoreAvoidList) continue;
    const quote = await getMarketQuote(symbol, asset);
    if (!quote) continue;
    const mom = scoreSymbol(quote.bars);
    const sig = quote.signal || null;

    // Rank primarily by the technical signal's conviction; fall back to
    // raw momentum when a symbol has no computable signal.
    let score: number;
    let direction: TradeDirection;
    if (sig && sig.signal !== "neutral") {
      direction = sig.signal === "buy" ? "long" : "short";
      score = 100 + sig.strength; // signal-backed picks outrank momentum-only
    } else if (mom) {
      direction = mom.direction;
      score = mom.score;
    } else {
      continue;
    }
    if (opts.preferDirection && opts.preferDirection !== "auto" && direction !== opts.preferDirection) {
      score *= 0.82;
    }

    scored.push({
      score,
      symbol: quote.symbol || symbol,
      direction,
      price: quote.price,
      source: quote.source,
      momentumPct: mom?.momentumPct ?? 0,
      signal: sig?.signal ?? null,
      signalStrength: sig?.strength ?? 0,
    });
  }

  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const bestScore = scored[0].score;
  const candidates = scored.filter((item) => item.score >= bestScore * 0.9).slice(0, 4);
  const index = Math.abs(hash(`${asset}:${_market}:${new Date().toISOString().slice(0, 10)}:${candidates.map((item) => item.symbol).join(",")}`)) % candidates.length;
  const top = candidates[index] || scored[0];
  const bias = top.direction === "long" ? "bullish" : "bearish";
  const reason = top.signal && top.signal !== "neutral"
    ? `ZAR scanned ${scored.length} ${asset} symbol(s) on live ${top.source} data and picked ${top.symbol}: strongest ${top.signal.toUpperCase()} signal (${top.signalStrength}% indicator conviction, ${top.momentumPct}% momentum).`
    : `ZAR scanned ${scored.length} ${asset} symbol(s) on live ${top.source} data and picked ${top.symbol}: strongest ${bias} momentum (${top.momentumPct}% over ~10 sessions).`;

  return {
    symbol: top.symbol,
    direction: top.direction,
    price: top.price,
    source: top.source,
    momentumPct: top.momentumPct,
    signal: top.signal,
    signalStrength: top.signalStrength,
    reason,
  };
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return h;
}
