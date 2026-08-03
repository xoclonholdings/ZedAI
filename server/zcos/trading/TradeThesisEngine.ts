import type {
  SetupStatus,
  TradeDirection,
  TradeThesis,
  TradingAssetClass,
} from "../../../shared/trading-types";

import { buildTradingKnowledgeContext } from "./TradingKnowledgeBase";
import { TradingStore } from "./TradingStore";

export interface CreateTradeThesisInput {
  userId: string;
  market: string;
  assetClass: TradingAssetClass;
  symbol: string;
  direction: TradeDirection;
  reason: string;
  marketStructure: string;
  liquidityAnalysis: string;
  timeframeAlignment?: Record<string, string>;
  primaryTimeframe?: string;
  entryPlan: string;
  stopPlan: string;
  targetPlan: string;
  riskReward?: number | null;
  invalidationConditions: string[];
  confidenceScore?: number;
  setupType?: string;
  status?: SetupStatus;
  notes?: string;
}

function clampConfidence(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferStatus(input: CreateTradeThesisInput): SetupStatus {
  if (input.status) return input.status;
  const hasRequiredPlan = Boolean(
    input.reason &&
      input.marketStructure &&
      input.liquidityAnalysis &&
      input.entryPlan &&
      input.stopPlan &&
      input.targetPlan &&
      input.invalidationConditions.length > 0,
  );
  if (!hasRequiredPlan) return "observe";
  if ((input.riskReward || 0) >= 2 && clampConfidence(input.confidenceScore) >= 70) return "valid_setup";
  return "possible_setup";
}

export async function createTradeThesis(input: CreateTradeThesisInput): Promise<TradeThesis> {
  const knowledgeContext = await buildTradingKnowledgeContext(
    `${input.symbol} ${input.assetClass} ${input.marketStructure} ${input.liquidityAnalysis} ${input.reason}`,
  );

  const thesis = await TradingStore.addThesis({
    userId: input.userId,
    market: input.market,
    assetClass: input.assetClass,
    symbol: input.symbol.toUpperCase(),
    direction: input.direction,
    status: inferStatus(input),
    reason: input.reason,
    marketStructure: input.marketStructure,
    liquidityAnalysis: input.liquidityAnalysis,
    timeframeAlignment: input.timeframeAlignment || {},
    primaryTimeframe: input.primaryTimeframe,
    entryPlan: input.entryPlan,
    stopPlan: input.stopPlan,
    targetPlan: input.targetPlan,
    riskReward: typeof input.riskReward === "number" ? input.riskReward : null,
    invalidationConditions: input.invalidationConditions,
    confidenceScore: clampConfidence(input.confidenceScore),
    setupType: input.setupType,
    outcome: "unresolved",
    notes: [input.notes, `Relevant knowledge:\n${knowledgeContext}`].filter(Boolean).join("\n\n"),
  });

  return thesis;
}
