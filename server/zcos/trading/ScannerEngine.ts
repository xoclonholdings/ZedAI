import type { SetupStatus, TradingAssetClass } from "../../../shared/trading-types";

import { TradingStore } from "./TradingStore";

export interface ScannerObservation {
  symbol: string;
  assetClass: TradingAssetClass;
  timeframe: string;
  trend?: "up" | "down" | "range" | "unclear";
  structureEvent?: "bos" | "choch" | "breakout" | "reversal" | "none";
  liquidityEvent?: "sweep" | "grab" | "equal_highs" | "equal_lows" | "none";
  confluenceScore?: number;
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
}

function clampScore(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function classify(score: number, observation: ScannerObservation): SetupStatus {
  if (observation.trend === "unclear" || observation.structureEvent === "none") return "observe";
  if (score >= 75 && (observation.riskReward || 0) >= 2) return "valid_setup";
  if (score >= 55) return "possible_setup";
  if (score >= 35) return "watch";
  return "no_trade";
}

export async function evaluateScannerObservation(observation: ScannerObservation): Promise<ScannerResult> {
  const reasons: string[] = [];
  let score = clampScore(observation.confluenceScore);

  if (observation.structureEvent && observation.structureEvent !== "none") {
    score += 10;
    reasons.push(`Structure event detected: ${observation.structureEvent}.`);
  }
  if (observation.liquidityEvent && observation.liquidityEvent !== "none") {
    score += 10;
    reasons.push(`Liquidity event detected: ${observation.liquidityEvent}.`);
  }
  if ((observation.riskReward || 0) >= 2) {
    score += 10;
    reasons.push(`Risk/reward is acceptable at ${observation.riskReward}.`);
  }
  if (observation.trend && observation.trend !== "unclear") {
    score += 5;
    reasons.push(`Trend context: ${observation.trend}.`);
  }

  score = Math.min(100, score);
  const status = classify(score, observation);
  const requiredNextChecks = [
    "Confirm multi-timeframe alignment before thesis creation.",
    "Define invalidation before opening any paper trade.",
    "Do not treat scanner output as execution approval.",
  ];

  const result: ScannerResult = {
    symbol: observation.symbol.toUpperCase(),
    assetClass: observation.assetClass,
    timeframe: observation.timeframe,
    status,
    score,
    reasons: reasons.length ? reasons : ["No high-confluence condition detected."],
    requiredNextChecks,
  };

  await TradingStore.appendMemory(
    `Scanner result: ${result.symbol} ${result.timeframe} => ${result.status} (${result.score}).`,
  );

  return result;
}
