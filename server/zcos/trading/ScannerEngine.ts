import type { SetupStatus, TradingAssetClass } from "../../../shared/trading-types";
import type { MarketStructureAnalysis } from "../../../shared/market-structure-types";

import { TradingStore } from "./TradingStore";
import { getMultiTimeframeSeries, getMarketQuote } from "./MarketDataService";
import { analyzeMarketStructure } from "./MarketStructureEngine";

export interface ScannerObservation {
  symbol: string;
  assetClass: TradingAssetClass;
  timeframe?: string;
  riskReward?: number;
  notes?: string;
}

export interface ScannerResult {
  symbol: string;
  assetClass: TradingAssetClass;
  timeframe: string;
  status: SetupStatus;
  score: number;
  reasons: string[];
  requiredNextChecks: string[];
  structure: MarketStructureAnalysis | null;
}

function classify(score: number, riskReward: number | undefined, hasStructure: boolean): SetupStatus {
  if (!hasStructure) return "observe";
  if (score >= 75 && (riskReward || 0) >= 2) return "valid_setup";
  if (score >= 55) return "possible_setup";
  if (score >= 35) return "watch";
  return "no_trade";
}

/**
 * Evaluates a symbol from real, computed market structure — swings,
 * structural events, liquidity, order blocks, and multi-timeframe
 * alignment — instead of trusting caller-supplied structure/liquidity
 * flags. The confluence score and structure read come directly from
 * `MarketStructureEngine`, the same engine strategy generation and
 * governance use, so the scanner, the strategy proposal, and the
 * governance checklist can no longer disagree about what's actually
 * happening in price.
 */
export async function evaluateScannerObservation(observation: ScannerObservation): Promise<ScannerResult> {
  const symbol = observation.symbol.toUpperCase();
  const reasons: string[] = [];

  const [series, quote] = await Promise.all([
    getMultiTimeframeSeries(symbol, observation.assetClass),
    getMarketQuote(symbol, observation.assetClass),
  ]);

  const primaryTimeframe = observation.timeframe || (series[0]?.timeframe ?? "Daily");
  const structure = series.length
    ? analyzeMarketStructure(symbol, series, primaryTimeframe, quote?.signal)
    : null;

  let score = structure?.confluence.score ?? 0;

  if (structure) {
    reasons.push(structure.explanation);
  } else {
    reasons.push("No live price history was reachable for this symbol, so market structure could not be read.");
  }

  if ((observation.riskReward || 0) >= 2) {
    score = Math.min(100, score + 5);
    reasons.push(`Risk/reward is acceptable at ${observation.riskReward}.`);
  }

  const status = classify(score, observation.riskReward, structure !== null);
  const requiredNextChecks = [
    "Confirm multi-timeframe alignment before thesis creation.",
    "Define invalidation before opening any paper trade.",
    "Do not treat scanner output as execution approval.",
  ];

  const result: ScannerResult = {
    symbol,
    assetClass: observation.assetClass,
    timeframe: primaryTimeframe,
    status,
    score,
    reasons,
    requiredNextChecks,
    structure,
  };

  await TradingStore.appendMemory(
    `Scanner result: ${result.symbol} ${result.timeframe} => ${result.status} (${result.score}).`,
  );

  return result;
}
