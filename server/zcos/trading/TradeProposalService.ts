import type { TradeDirection, TradingAssetClass } from "../../../shared/trading-types";
import type { TradingSignal } from "../../../shared/trading-training-types";

import { generateTradeStrategy, type DirectionPreference, type GeneratedStrategy } from "./TradeStrategyGenerator";
import { createTradeThesis } from "./TradeThesisEngine";
import { getMarketQuote, type MarketQuote } from "./MarketDataService";
import { recommendSymbol } from "./SymbolRecommender";
import { getWebullMarketQuote, recommendWebullSymbol } from "./WebullBridge";

/**
 * One "propose a trade" flow shared by every execution target (internal
 * simulation, Webull, and any future broker). Previously this logic was
 * duplicated near-verbatim between /api/trading/strategies/propose and
 * /api/trading/webull/propose — same steps, different data source. The
 * only thing that actually differs between providers is *where the data
 * comes from*, so that's the one seam: a TradeDataAdapter.
 */

export interface RecommendationResult {
  symbol: string;
  direction: TradeDirection;
  reason: string;
  quote?: MarketQuote;
}

export interface TradeDataAdapter {
  /** Human label surfaced in error messages ("Zed's live feed", "Webull"). */
  label: string;
  recommendSymbol: (
    asset: TradingAssetClass,
    market: string,
    opts: { avoidSymbols?: string[]; preferDirection?: TradeDirection | "auto" },
  ) => Promise<RecommendationResult | null>;
  /** May throw to surface a provider-specific error (e.g. Webull entitlement issue). */
  getQuote: (symbol: string, asset: TradingAssetClass) => Promise<MarketQuote | null>;
}

/** Zed's own live feed (Yahoo/Stooq/keyed vendors) — never throws, falls back to a paper reference. */
export function internalTradeDataAdapter(): TradeDataAdapter {
  return {
    label: "Zed's live feed",
    recommendSymbol: (asset, market, opts) => recommendSymbol(asset, market, opts),
    getQuote: (symbol, asset) => getMarketQuote(symbol, asset),
  };
}

/** Webull OpenAPI — the connected account's own market data. Throws its real error on failure. */
export function webullTradeDataAdapter(userId: string): TradeDataAdapter {
  return {
    label: "Webull",
    recommendSymbol: (asset, market, opts) => recommendWebullSymbol(userId, asset, market, opts),
    getQuote: (symbol, asset) => getWebullMarketQuote(userId, symbol, asset),
  };
}

export interface ProposeTradeInput {
  userId: string;
  adapter: TradeDataAdapter;
  asset: TradingAssetClass;
  market: string;
  symbol?: string;
  directionPreference?: DirectionPreference;
  timeframe?: string;
  referencePrice?: number;
  avoidSymbols?: string[];
  /** Prefixed onto the thesis notes, e.g. "Webull external paper proposal." */
  notesPrefix?: string;
}

export interface MarketDataSummary {
  live: boolean;
  source: string | null;
  price: number | null;
  asOf: string | null;
  atr: number | null;
}

export type ProposeTradeResult =
  | { kind: "error"; statusCode: number; error: string }
  | { kind: "no_trade"; symbol: string; marketData: MarketDataSummary; signal: TradingSignal | null; reason: string }
  | {
      kind: "ok";
      strategy: GeneratedStrategy;
      thesisId: string;
      marketData: MarketDataSummary;
      signal: TradingSignal | null;
      recommendedSymbol: { symbol: string; reason: string } | null;
    };

function summarize(quote: MarketQuote | null): MarketDataSummary {
  return quote
    ? { live: true, source: quote.source, price: quote.price, asOf: quote.asOf, atr: quote.atr ?? null }
    : { live: false, source: null, price: null, asOf: null, atr: null };
}

export async function proposeTrade(input: ProposeTradeInput): Promise<ProposeTradeResult> {
  let symbol = (input.symbol || "").trim().toUpperCase();
  let directionPreference: DirectionPreference = input.directionPreference || "auto";
  let recommendation: RecommendationResult | null = null;
  let quote: MarketQuote | null = null;

  if (!symbol) {
    try {
      recommendation = await input.adapter.recommendSymbol(input.asset, input.market, {
        avoidSymbols: input.avoidSymbols,
        preferDirection: directionPreference,
      });
    } catch (err: any) {
      return {
        kind: "error",
        statusCode: 422,
        error: `${input.adapter.label} market data is unavailable: ${err?.message || "unknown error"}`,
      };
    }
    if (!recommendation) {
      return {
        kind: "error",
        statusCode: 422,
        error: `${input.adapter.label} returned no usable market data to pick a symbol.`,
      };
    }
    symbol = recommendation.symbol;
    quote = recommendation.quote ?? null;
    if (directionPreference === "auto") directionPreference = recommendation.direction;
  }

  if (!quote) {
    try {
      quote = await input.adapter.getQuote(symbol, input.asset);
    } catch (err: any) {
      return {
        kind: "error",
        statusCode: 422,
        error: `${input.adapter.label} market data is unavailable for ${symbol}: ${err?.message || "unknown error"}`,
      };
    }
  }

  // A neutral read means the indicators don't agree on a direction — Zed
  // doesn't force a trade just to have one, on any execution target.
  if (quote?.signal?.signal === "neutral") {
    return {
      kind: "no_trade",
      symbol,
      marketData: summarize(quote),
      signal: quote.signal,
      reason: `No trade proposed for ${symbol}: live signal is neutral (${quote.signal.bullish} bullish / ${quote.signal.bearish} bearish).`,
    };
  }

  if (directionPreference === "auto" && quote?.signal && quote.signal.signal !== "neutral") {
    directionPreference = quote.signal.signal === "buy" ? "long" : "short";
  }

  const strategy = await generateTradeStrategy({
    userId: input.userId,
    symbol,
    asset: input.asset,
    market: input.market,
    directionPreference,
    timeframe: input.timeframe,
    referencePrice: input.referencePrice ?? quote?.price,
    stopDistance: quote?.atr,
    signal: quote?.signal ?? null,
  });

  const thesis = await createTradeThesis({
    userId: input.userId,
    market: input.market,
    assetClass: input.asset,
    symbol: strategy.symbol,
    direction: strategy.direction,
    reason: strategy.thesis,
    marketStructure: strategy.marketStructure,
    liquidityAnalysis: strategy.liquidityAnalysis,
    timeframeAlignment: strategy.timeframeAlignment,
    primaryTimeframe: strategy.timeframe,
    entryPlan: strategy.entryPlan,
    stopPlan: strategy.stopPlan,
    targetPlan: strategy.targetPlan,
    riskReward: strategy.riskReward,
    invalidationConditions: strategy.invalidation.split("\n").map((s) => s.trim()).filter(Boolean),
    confidenceScore: strategy.confidence,
    notes: input.notesPrefix ? `${input.notesPrefix} ${strategy.basis}` : strategy.basis,
  });

  return {
    kind: "ok",
    strategy,
    thesisId: thesis.id,
    marketData: summarize(quote),
    signal: quote?.signal ?? null,
    recommendedSymbol: recommendation ? { symbol: recommendation.symbol, reason: recommendation.reason } : null,
  };
}
