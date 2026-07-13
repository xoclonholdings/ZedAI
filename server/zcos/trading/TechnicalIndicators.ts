import type {
  IndicatorVote,
  TradingSignal,
} from "../../../shared/trading-training-types";

import type { MarketBar } from "./MarketDataService";

/**
 * Standard technical indicators computed from real daily bars, combined
 * into a single BUY / SELL / NEUTRAL signal.
 *
 * The signal is a vote across well-known indicators — moving-average
 * trend, EMA crossover, RSI, MACD, and short-term momentum. Each casts a
 * bullish / bearish / neutral vote; the majority sets the signal and the
 * margin sets conviction. Everything is derived from the live price
 * history — no invented levels.
 */

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const window = values.slice(-period);
  return window.reduce((a, b) => a + b, 0) / period;
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` values, then roll forward.
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

/** Full EMA series (same length as input, undefined until it can seed). */
function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  // Seed average over the first `period` changes.
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  // Wilder smoothing over the rest.
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < slow + signalPeriod) return null;
  const fastSeries = emaSeries(closes, fast);
  const slowSeries = emaSeries(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastSeries[i] != null && slowSeries[i] != null) macdLine.push(fastSeries[i] - slowSeries[i]);
  }
  const signalLine = ema(macdLine, signalPeriod);
  if (signalLine == null || !macdLine.length) return null;
  const macdVal = macdLine[macdLine.length - 1];
  return { macd: macdVal, signal: signalLine, histogram: macdVal - signalLine };
}

export function computeSignal(bars: MarketBar[] | undefined): TradingSignal | null {
  if (!bars || bars.length < 30) return null;
  const closes = bars.map((b) => b.c).filter((c) => Number.isFinite(c) && c > 0);
  if (closes.length < 30) return null;
  const last = closes[closes.length - 1];
  const votes: IndicatorVote[] = [];

  // 1. Moving-average trend (price vs SMA20 vs SMA50).
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, Math.min(50, closes.length));
  if (sma20 != null && sma50 != null) {
    const verdict = last > sma20 && sma20 >= sma50 ? "bullish" : last < sma20 && sma20 <= sma50 ? "bearish" : "neutral";
    votes.push({
      name: "MA trend",
      verdict,
      detail: `Price ${round(last)} vs SMA20 ${round(sma20)} / SMA50 ${round(sma50)}.`,
    });
  }

  // 2. EMA crossover (9 vs 21).
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  if (ema9 != null && ema21 != null) {
    const verdict = ema9 > ema21 ? "bullish" : ema9 < ema21 ? "bearish" : "neutral";
    votes.push({
      name: "EMA 9/21",
      verdict,
      detail: `EMA9 ${round(ema9)} ${ema9 > ema21 ? ">" : "<"} EMA21 ${round(ema21)}.`,
    });
  }

  // 3. RSI(14).
  const rsiVal = rsi(closes, 14);
  if (rsiVal != null) {
    const verdict = rsiVal >= 55 ? "bullish" : rsiVal <= 45 ? "bearish" : "neutral";
    const zone = rsiVal >= 70 ? " (overbought)" : rsiVal <= 30 ? " (oversold)" : "";
    votes.push({ name: "RSI 14", verdict, detail: `RSI ${round(rsiVal, 1)}${zone}.` });
  }

  // 4. MACD(12,26,9).
  const m = macd(closes);
  if (m) {
    const verdict = m.histogram > 0 ? "bullish" : m.histogram < 0 ? "bearish" : "neutral";
    votes.push({
      name: "MACD",
      verdict,
      detail: `MACD ${round(m.macd, 3)} vs signal ${round(m.signal, 3)} (hist ${round(m.histogram, 3)}).`,
    });
  }

  // 5. Short-term momentum (10-bar).
  const ref = closes[closes.length - 11] ?? closes[0];
  if (ref > 0) {
    const mom = (last - ref) / ref;
    const verdict = mom > 0.01 ? "bullish" : mom < -0.01 ? "bearish" : "neutral";
    votes.push({ name: "Momentum", verdict, detail: `${round(mom * 100, 1)}% over ~10 sessions.` });
  }

  if (!votes.length) return null;
  const bullish = votes.filter((v) => v.verdict === "bullish").length;
  const bearish = votes.filter((v) => v.verdict === "bearish").length;
  const net = bullish - bearish;
  const signal: TradingSignal["signal"] = net > 0 ? "buy" : net < 0 ? "sell" : "neutral";
  const strength = Math.round((Math.abs(net) / votes.length) * 100);

  const summary =
    signal === "neutral"
      ? `Mixed signals (${bullish} bullish / ${bearish} bearish) — no clear edge.`
      : `${signal.toUpperCase()} — ${signal === "buy" ? bullish : bearish} of ${votes.length} indicators agree (${strength}% conviction).`;

  return { signal, strength, bullish, bearish, votes, summary };
}
