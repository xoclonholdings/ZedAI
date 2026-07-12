import type { TradingAssetClass } from "../../../shared/trading-types";

/**
 * Real market-data access for Zed.
 *
 * Fetches a live quote (last price + recent daily bars for volatility) so
 * the trade proposer prices setups off real levels instead of a paper
 * reference. Providers are tried in order; the first that answers wins:
 *
 *   1. Keyed vendors, if their API key env var is set (more reliable and
 *      redistribution-friendly): Alpha Vantage, Twelve Data, Finnhub.
 *   2. Keyless fallbacks: Yahoo Finance (price + OHLC history), Stooq
 *      (quote only).
 *
 * Every call is best-effort and time-boxed. If nothing is reachable
 * (locked-down network, no key, symbol not found) it returns null and the
 * caller falls back to the labelled paper reference — the data source is
 * always surfaced so the user can see whether the number is live or not.
 *
 * Env keys (all optional): ALPHAVANTAGE_API_KEY, TWELVEDATA_API_KEY,
 * FINNHUB_API_KEY.
 */

export interface MarketBar {
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  /** ISO timestamp of the quote. */
  asOf: string;
  /** Human-readable provider name, surfaced to the user. */
  source: string;
  /** Average true range over recent daily bars (absolute price), if known. */
  atr?: number;
}

const TIMEOUT_MS = 7000;

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (ZedAI market-data)", ...(headers || {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (ZedAI market-data)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function positive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Average true range over up to `period` daily bars. */
export function averageTrueRange(bars: MarketBar[], period = 14): number | undefined {
  const clean = bars.filter((b) => positive(b.h) && positive(b.l) && positive(b.c));
  if (clean.length < 2) return undefined;
  const trs: number[] = [];
  for (let i = 1; i < clean.length; i++) {
    const cur = clean[i];
    const prevClose = clean[i - 1].c;
    const tr = Math.max(
      cur.h - cur.l,
      Math.abs(cur.h - prevClose),
      Math.abs(cur.l - prevClose),
    );
    if (Number.isFinite(tr) && tr > 0) trs.push(tr);
  }
  if (!trs.length) return undefined;
  const window = trs.slice(-period);
  const avg = window.reduce((sum, v) => sum + v, 0) / window.length;
  return Number.isFinite(avg) && avg > 0 ? Math.round(avg * 100) / 100 : undefined;
}

/** Map an internal symbol/asset to a Yahoo Finance ticker. */
export function toYahooSymbol(symbol: string, asset: TradingAssetClass): string {
  const s = symbol.trim().toUpperCase();
  switch (asset) {
    case "crypto": {
      if (s.includes("-")) return s;
      const base = s.replace(/USDT?$/i, "").replace(/USD$/i, "") || s;
      return `${base}-USD`;
    }
    case "forex": {
      const pair = s.replace(/[^A-Z]/g, "");
      return pair.endsWith("=X") ? pair : `${pair}=X`;
    }
    case "future":
      return s.includes("=F") ? s : `${s}=F`;
    default:
      return s;
  }
}

/** Parse a Yahoo Finance chart payload into a quote. Exported for tests. */
export function parseYahooChart(json: any, fallbackSymbol: string): MarketQuote | null {
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta || {};
  const price = meta.regularMarketPrice;
  if (!positive(price)) return null;
  const quote = result.indicators?.quote?.[0] || {};
  const opens: number[] = quote.open || [];
  const highs: number[] = quote.high || [];
  const lows: number[] = quote.low || [];
  const closes: number[] = quote.close || [];
  const bars: MarketBar[] = [];
  for (let i = 0; i < closes.length; i++) {
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    if (positive(o) && positive(h) && positive(l) && positive(c)) bars.push({ o, h, l, c });
  }
  const asOfSeconds = meta.regularMarketTime;
  return {
    symbol: meta.symbol || fallbackSymbol,
    price: Math.round(price * 100) / 100,
    asOf: positive(asOfSeconds) ? new Date(asOfSeconds * 1000).toISOString() : new Date().toISOString(),
    source: "Yahoo Finance",
    atr: averageTrueRange(bars),
  };
}

async function fromYahoo(symbol: string, asset: TradingAssetClass): Promise<MarketQuote | null> {
  const ticker = encodeURIComponent(toYahooSymbol(symbol, asset));
  const json = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`,
  );
  return json ? parseYahooChart(json, symbol.toUpperCase()) : null;
}

/** Map an internal symbol/asset to a Stooq ticker. */
export function toStooqSymbol(symbol: string, asset: TradingAssetClass): string {
  const s = symbol.trim().toLowerCase();
  if (asset === "crypto") return s.includes(".") ? s : s; // e.g. btcusd
  if (asset === "forex") return s.replace(/[^a-z]/g, "");
  if (s.includes(".")) return s;
  return `${s}.us`;
}

/** Parse a Stooq CSV line into a quote. Exported for tests. */
export function parseStooqCsv(csv: string, fallbackSymbol: string): MarketQuote | null {
  // Header: Symbol,Date,Time,Open,High,Low,Close,Volume
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const cols = lines[1].split(",");
  if (cols.length < 7) return null;
  const close = Number(cols[6]);
  if (!positive(close)) return null;
  const date = cols[1];
  const time = cols[2];
  const asOf =
    date && date !== "N/D"
      ? new Date(`${date}T${time && time !== "N/D" ? time : "00:00:00"}Z`).toISOString()
      : new Date().toISOString();
  return {
    symbol: (cols[0] || fallbackSymbol).toUpperCase(),
    price: Math.round(close * 100) / 100,
    asOf,
    source: "Stooq",
  };
}

async function fromStooq(symbol: string, asset: TradingAssetClass): Promise<MarketQuote | null> {
  const ticker = encodeURIComponent(toStooqSymbol(symbol, asset));
  const csv = await fetchText(`https://stooq.com/q/l/?s=${ticker}&f=sd2t2ohlcv&h&e=csv`);
  return csv ? parseStooqCsv(csv, symbol.toUpperCase()) : null;
}

async function fromAlphaVantage(symbol: string): Promise<MarketQuote | null> {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) return null;
  const json = await fetchJson(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`,
  );
  const q = json?.["Global Quote"];
  const price = Number(q?.["05. price"]);
  if (!positive(price)) return null;
  return {
    symbol: q?.["01. symbol"] || symbol.toUpperCase(),
    price: Math.round(price * 100) / 100,
    asOf: new Date().toISOString(),
    source: "Alpha Vantage",
  };
}

async function fromTwelveData(symbol: string): Promise<MarketQuote | null> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return null;
  const json = await fetchJson(
    `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${key}`,
  );
  const price = Number(json?.close);
  if (!positive(price)) return null;
  const atrRaw = Number(json?.average_volume); // not ATR; leave undefined
  void atrRaw;
  return {
    symbol: json?.symbol || symbol.toUpperCase(),
    price: Math.round(price * 100) / 100,
    asOf: new Date().toISOString(),
    source: "Twelve Data",
  };
}

async function fromFinnhub(symbol: string): Promise<MarketQuote | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  const json = await fetchJson(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`,
  );
  const price = Number(json?.c);
  if (!positive(price)) return null;
  return {
    symbol: symbol.toUpperCase(),
    price: Math.round(price * 100) / 100,
    asOf: positive(json?.t) ? new Date(json.t * 1000).toISOString() : new Date().toISOString(),
    source: "Finnhub",
  };
}

/**
 * Get a live quote for a symbol, or null if no source is reachable.
 * Keyed vendors are preferred when configured; keyless sources are the
 * fallback so this works with zero setup wherever the network allows.
 */
export async function getMarketQuote(
  symbol: string,
  asset: TradingAssetClass,
): Promise<MarketQuote | null> {
  const clean = String(symbol || "").trim();
  if (!clean) return null;

  const providers: Array<() => Promise<MarketQuote | null>> = [
    () => fromAlphaVantage(clean),
    () => fromTwelveData(clean),
    () => fromFinnhub(clean),
    () => fromYahoo(clean, asset),
    () => fromStooq(clean, asset),
  ];

  for (const provider of providers) {
    try {
      const quote = await provider();
      if (quote && positive(quote.price)) return quote;
    } catch {
      /* try the next provider */
    }
  }
  return null;
}

/** True when at least one keyed vendor is configured. */
export function hasKeyedMarketDataProvider(): boolean {
  return Boolean(
    process.env.ALPHAVANTAGE_API_KEY ||
      process.env.TWELVEDATA_API_KEY ||
      process.env.FINNHUB_API_KEY,
  );
}
