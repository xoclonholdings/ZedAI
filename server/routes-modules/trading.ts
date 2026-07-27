import type { Express } from "express";

import { registerTradingKnowledgeRoutes } from "./trading-knowledge";
import { registerTradingStrategyRoutes } from "./trading-strategy";
import { registerTradingMarketDataRoutes } from "./trading-market-data";
import { registerTradingPaperRoutes } from "./trading-paper";
import { registerTradingStagesRoutes } from "./trading-stages";
import { registerTradingWebullRoutes } from "./trading-webull";
import { registerTradingPolymarketRoutes } from "./trading-polymarket";
import { registerTradingTradovateRoutes } from "./trading-tradovate";

/**
 * Phase 1 Trading Intelligence routes — split by domain across the
 * trading-* sibling modules (knowledge/curriculum, strategy/theses,
 * market data, paper trading/governance, progression stages, and the
 * Webull/Polymarket/Tradovate execution bridges). This file just wires
 * them all up so the rest of the app can keep importing one function.
 */
export function registerTradingRoutes(app: Express): void {
  registerTradingKnowledgeRoutes(app);
  registerTradingStrategyRoutes(app);
  registerTradingMarketDataRoutes(app);
  registerTradingPaperRoutes(app);
  registerTradingStagesRoutes(app);
  registerTradingWebullRoutes(app);
  registerTradingPolymarketRoutes(app);
  registerTradingTradovateRoutes(app);
}
