import type { TradingAssetClass, TradingKnowledgeEntry } from "../../../shared/trading-types";

import { importTradingKnowledge } from "./TradingKnowledgeBase";
import { TradingStore } from "./TradingStore";

export interface TradingViewSnapshotInput {
  userId: string;
  symbol: string;
  assetClass: TradingAssetClass;
  timeframe: string;
  chartUrl?: string;
  indicators?: string[];
  notes: string;
  tags?: string[];
}

export async function importTradingViewSnapshot(input: TradingViewSnapshotInput): Promise<TradingKnowledgeEntry> {
  const symbol = input.symbol.toUpperCase();
  const source = input.chartUrl || `TradingView:${symbol}:${input.timeframe}`;
  const text = [
    `Symbol: ${symbol}`,
    `Asset class: ${input.assetClass}`,
    `Timeframe: ${input.timeframe}`,
    input.indicators?.length ? `Indicators: ${input.indicators.join(", ")}` : "Indicators: none listed",
    input.notes,
  ].join("\n");

  const entry = await importTradingKnowledge({
    source,
    sourceType: "tradingview",
    title: `TradingView snapshot: ${symbol} ${input.timeframe}`,
    text,
    tags: [symbol, input.assetClass, input.timeframe, ...(input.tags || [])],
  });

  await TradingStore.addTradingViewRecord({
    userId: input.userId,
    type: "note",
    symbol,
    assetClass: input.assetClass,
    timeframe: input.timeframe,
    title: `Chart snapshot ${symbol} ${input.timeframe}`,
    status: "active",
    chartUrl: input.chartUrl,
    notes: input.notes,
    tags: [symbol, input.assetClass, input.timeframe, ...(input.tags || [])],
  });

  await TradingStore.appendMemory(
    `TradingView snapshot imported for ${symbol} on ${input.timeframe}.`,
  );

  return entry;
}
