import type { TradingAssetClass, TradingKnowledgeEntry } from "../../../shared/trading-types";

import { importTradingKnowledge } from "./TradingKnowledgeBase";
import { TradingStore } from "./TradingStore";

export interface TradingViewSnapshotInput {
  symbol: string;
  assetClass: TradingAssetClass;
  timeframe: string;
  chartUrl?: string;
  indicators?: string[];
  notes: string;
  tags?: string[];
}

export async function importTradingViewSnapshot(input: TradingViewSnapshotInput): Promise<TradingKnowledgeEntry> {
  const source = input.chartUrl || `TradingView:${input.symbol}:${input.timeframe}`;
  const text = [
    `Symbol: ${input.symbol.toUpperCase()}`,
    `Asset class: ${input.assetClass}`,
    `Timeframe: ${input.timeframe}`,
    input.indicators?.length ? `Indicators: ${input.indicators.join(", ")}` : "Indicators: none listed",
    input.notes,
  ].join("\n");

  const entry = await importTradingKnowledge({
    source,
    sourceType: "tradingview",
    title: `TradingView snapshot: ${input.symbol.toUpperCase()} ${input.timeframe}`,
    text,
    tags: [input.symbol.toUpperCase(), input.assetClass, input.timeframe, ...(input.tags || [])],
  });

  await TradingStore.appendMemory(
    `TradingView snapshot imported for ${input.symbol.toUpperCase()} on ${input.timeframe}.`,
  );

  return entry;
}
