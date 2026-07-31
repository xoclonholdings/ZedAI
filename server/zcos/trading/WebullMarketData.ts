import type { TradeDirection, TradingAssetClass } from "../../../shared/trading-types";
import { averageTrueRange, type MarketBar, type MarketQuote } from "./MarketDataService";
import { computeSignal } from "./TechnicalIndicators";
import {
  explainWebullAuthFailure,
  getWebullConnection,
  webullCredentialCandidates,
  webullDataHost,
  webullFetch,
  envValue,
} from "./WebullShared";

/**
 * Native Webull market data. Confirmed against the official SDK's own
 * request classes:
 *   GET /openapi/market-data/stock/snapshot (v2) — symbols, category,
 *     extend_hour_required, overnight_required
 *   GET /openapi/market-data/stock/bars (v2) — symbol, category,
 *     timespan, count
 * Both live on Webull's dedicated data host (data-api.webull.com), never
 * the trading/sandbox host — there is no sandbox for market data.
 */

const SNAPSHOT_PATH = "/openapi/market-data/stock/snapshot";
const BARS_PATH = "/openapi/market-data/stock/bars";

const CATEGORY: Record<TradingAssetClass, string> = {
  stock: "US_STOCK",
  etf: "US_ETF",
  option: "US_OPTION",
  future: "US_FUTURES",
  crypto: "US_CRYPTO",
  forex: "US_STOCK",
};

const WEBULL_SCAN_UNIVERSE: Record<TradingAssetClass, string[]> = {
  stock: ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AMD"],
  etf: ["SPY", "QQQ", "IWM", "DIA"],
  option: ["SPY", "QQQ", "AAPL", "NVDA"],
  future: ["ES", "NQ", "YM", "CL", "GC"],
  crypto: ["BTCUSD", "ETHUSD", "SOLUSD"],
  forex: [],
};

function firstNumber(obj: any, keys: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  const candidates = Array.isArray(obj) ? obj : [obj];
  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    for (const key of keys) {
      const v = Number(item[key]);
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  return null;
}

function parseBars(data: any): MarketBar[] {
  const raw = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  const bars: MarketBar[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = Number(row.o ?? row.open ?? row.openPrice);
    const h = Number(row.h ?? row.high ?? row.highPrice);
    const l = Number(row.l ?? row.low ?? row.lowPrice);
    const c = Number(row.c ?? row.close ?? row.closePrice ?? row.last ?? row.lastPrice);
    if (o > 0 && h > 0 && l > 0 && c > 0) bars.push({ o, h, l, c });
  }
  return bars;
}

/** Fetch one symbol's live quote (price + recent daily bars) from Webull. */
export async function getWebullMarketQuote(
  userId: string,
  symbol: string,
  asset: TradingAssetClass = "stock",
): Promise<MarketQuote | null> {
  const connection = await getWebullConnection(userId);
  const credentials = webullCredentialCandidates(connection);
  if (!credentials.length) {
    throw new Error("Webull market data requires WEBULL_APP_KEY and WEBULL_APP_SECRET.");
  }
  const clean = symbol.trim().toUpperCase();
  const category = CATEGORY[asset] || "US_STOCK";
  const dataHost = envValue("WEBULL_DATA_ENDPOINT") || webullDataHost(envValue("WEBULL_REGION") || "us");

  const failures: string[] = [];
  for (const candidate of credentials) {
    const [snapshotRes, barsRes] = await Promise.all([
      webullFetch({
        host: dataHost,
        path: SNAPSHOT_PATH,
        appKey: candidate.appKey,
        appSecret: candidate.appSecret,
        query: { symbols: clean, category, extend_hour_required: "true", overnight_required: "true" },
      }),
      webullFetch({
        host: dataHost,
        path: BARS_PATH,
        appKey: candidate.appKey,
        appSecret: candidate.appSecret,
        query: { symbol: clean, category, timespan: "D", count: "90" },
      }),
    ]);

    if (snapshotRes.error || !snapshotRes.ok) {
      failures.push(
        `${candidate.source}: ${explainWebullAuthFailure(
          snapshotRes.error || `HTTP ${snapshotRes.status}: ${snapshotRes.text.slice(0, 240)}`,
          dataHost,
        )}`,
      );
      continue;
    }

    const bars = parseBars(barsRes.ok ? barsRes.data : null);
    const price =
      firstNumber(snapshotRes.data, ["lastPrice", "last", "close", "closePrice", "price", "tradePrice"]) ??
      (bars.length ? bars[bars.length - 1].c : null);

    if (!price) {
      failures.push(`${candidate.source}: Webull returned no usable price for ${clean}.`);
      continue;
    }

    return {
      symbol: clean,
      price: Math.round(price * 100) / 100,
      asOf: new Date().toISOString(),
      source: "Webull OpenAPI",
      atr: averageTrueRange(bars),
      bars,
      signal: computeSignal(bars) ?? undefined,
    };
  }
  throw new Error(`Webull market data failed for every credential source. ${failures.join(" | ")}`);
}

function scoreQuote(quote: MarketQuote): { score: number; direction: TradeDirection } | null {
  if (quote.signal && quote.signal.signal !== "neutral") {
    return { score: 100 + quote.signal.strength, direction: quote.signal.signal === "buy" ? "long" : "short" };
  }
  const closes = (quote.bars || []).map((bar) => bar.c).filter((c) => Number.isFinite(c) && c > 0);
  if (closes.length < 10) return null;
  const last = closes[closes.length - 1];
  const ref = closes[closes.length - 10];
  if (!(ref > 0)) return null;
  const momentum = (last - ref) / ref;
  return { score: Math.abs(momentum), direction: momentum >= 0 ? "long" : "short" };
}

/** Scan a small universe of liquid Webull symbols and pick the strongest mover. */
export async function recommendWebullSymbol(
  userId: string,
  asset: TradingAssetClass,
  _market = "US",
  opts: { avoidSymbols?: string[]; preferDirection?: TradeDirection | "auto" } = {},
): Promise<{ symbol: string; direction: TradeDirection; reason: string; quote: MarketQuote } | null> {
  const universe = WEBULL_SCAN_UNIVERSE[asset] || WEBULL_SCAN_UNIVERSE.stock;
  if (!universe.length) return null;
  const avoid = new Set((opts.avoidSymbols || []).map((s) => s.toUpperCase()));
  const scored: Array<{ symbol: string; direction: TradeDirection; score: number; quote: MarketQuote }> = [];
  for (const symbol of universe) {
    if (avoid.has(symbol.toUpperCase())) continue;
    try {
      const quote = await getWebullMarketQuote(userId, symbol, asset);
      if (!quote) continue;
      const scoredQuote = scoreQuote(quote);
      if (!scoredQuote) continue;
      let score = scoredQuote.score;
      if (opts.preferDirection && opts.preferDirection !== "auto" && scoredQuote.direction !== opts.preferDirection) {
        score *= 0.82;
      }
      scored.push({ symbol: quote.symbol || symbol, direction: scoredQuote.direction, score, quote });
    } catch {
      // Skip symbols Webull doesn't return; a total miss is handled below.
    }
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const signal = top.quote.signal;
  return {
    symbol: top.symbol,
    direction: top.direction,
    quote: top.quote,
    reason: signal
      ? `ZAR scanned ${scored.length} Webull ${asset} symbol(s) and picked ${top.symbol}: ${signal.signal.toUpperCase()} signal with ${signal.strength}% conviction.`
      : `ZAR scanned ${scored.length} Webull ${asset} symbol(s) and picked ${top.symbol}: strongest momentum from available bars.`,
  };
}
