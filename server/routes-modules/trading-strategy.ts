import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { createTradeThesis } from "../zcos/trading/TradeThesisEngine";
import { generateTradeStrategy } from "../zcos/trading/TradeStrategyGenerator";
import { proposeTrade, internalTradeDataAdapter } from "../zcos/trading/TradeProposalService";
import { evaluateTradeThesisGovernance } from "../zcos/trading/TradingGovernanceEngine";
import { TradingStore } from "../zcos/trading/TradingStore";
import { recommendSymbol } from "../zcos/trading/SymbolRecommender";
import { userIdFrom, toNumber, toArray, requireFields, findUserThesis } from "./trading-route-helpers";

/** Theses, strategy generation/proposal, and symbol recommendation. */
export function registerTradingStrategyRoutes(app: Express): void {
  app.get("/api/trading/theses", isAuthenticated, async (req: any, res) => {
    const theses = await TradingStore.listTheses(userIdFrom(req));
    res.json({ theses });
  });

  app.post("/api/trading/strategies/generate", isAuthenticated, async (req: any, res) => {
    const missing = requireFields(req.body || {}, ["symbol"]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    try {
      const strategy = await generateTradeStrategy({
        userId: userIdFrom(req),
        symbol: String(req.body.symbol),
        asset: req.body.asset || "stock",
        market: req.body.market ? String(req.body.market) : "US",
        directionPreference: req.body.directionPreference || "auto",
        timeframe: req.body.timeframe ? String(req.body.timeframe) : undefined,
      });
      res.json(strategy);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Strategy generation failed" });
    }
  });

  /**
   * ZAR proposes a COMPLETE paper trade the user can approve in one tap.
   * It generates the strategy (direction, thesis, structure, liquidity,
   * concrete entry/stop/target/size/risk sized to clear governance), then
   * persists a linked thesis so the market-structure and liquidity checks
   * pass. Returns the strategy plus the thesisId to attach when logging.
   */
  app.post("/api/trading/strategies/propose", isAuthenticated, async (req: any, res) => {
    try {
      const userId = userIdFrom(req);
      const asset = req.body.asset || "stock";
      const market = req.body.market ? String(req.body.market) : "US";
      const recentTrades = await TradingStore.listPaperTrades(userId);

      const result = await proposeTrade({
        userId,
        adapter: internalTradeDataAdapter(),
        asset,
        market,
        symbol: req.body.symbol ? String(req.body.symbol) : undefined,
        directionPreference: req.body.directionPreference || "auto",
        timeframe: req.body.timeframe ? String(req.body.timeframe) : undefined,
        referencePrice:
          req.body.referencePrice === undefined ? undefined : toNumber(req.body.referencePrice),
        avoidSymbols: recentTrades.slice(0, 12).map((trade) => trade.symbol),
      });

      if (result.kind === "error") return res.status(result.statusCode).json({ error: result.error });
      if (result.kind === "no_trade") {
        return res.json({
          action: "no_trade",
          symbol: result.symbol,
          marketData: result.marketData,
          signal: result.signal,
          reason: result.reason,
        });
      }
      res.json({
        ...result.strategy,
        thesisId: result.thesisId,
        session: result.strategy.session,
        marketData: result.marketData,
        signal: result.signal,
        structure: result.structure,
        recommendedSymbol: result.recommendedSymbol,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Trade proposal failed" });
    }
  });

  /** ZAR recommends a symbol to trade from live data (no symbol needed). */
  app.post("/api/trading/strategies/recommend-symbol", isAuthenticated, async (req: any, res) => {
    const asset = req.body.asset || "stock";
    const market = req.body.market ? String(req.body.market) : "US";
    const recommendation = await recommendSymbol(asset, market);
    if (!recommendation) {
      return res.status(422).json({
        error: "No live market-data source is reachable to scan symbols right now.",
      });
    }
    res.json(recommendation);
  });

  app.post("/api/trading/theses", isAuthenticated, async (req: any, res) => {
    const missing = requireFields(req.body || {}, [
      "market",
      "assetClass",
      "symbol",
      "direction",
      "reason",
      "marketStructure",
      "liquidityAnalysis",
      "entryPlan",
      "stopPlan",
      "targetPlan",
      "invalidationConditions",
    ]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const thesis = await createTradeThesis({
      userId: userIdFrom(req),
      market: String(req.body.market),
      assetClass: req.body.assetClass,
      symbol: String(req.body.symbol),
      direction: req.body.direction,
      reason: String(req.body.reason),
      marketStructure: String(req.body.marketStructure),
      liquidityAnalysis: String(req.body.liquidityAnalysis),
      timeframeAlignment: req.body.timeframeAlignment || {},
      primaryTimeframe: req.body.primaryTimeframe,
      entryPlan: String(req.body.entryPlan),
      stopPlan: String(req.body.stopPlan),
      targetPlan: String(req.body.targetPlan),
      riskReward: req.body.riskReward === undefined ? null : toNumber(req.body.riskReward),
      invalidationConditions: toArray(req.body.invalidationConditions),
      confidenceScore: toNumber(req.body.confidenceScore, 50),
      setupType: req.body.setupType ? String(req.body.setupType) : undefined,
      status: req.body.status,
      notes: req.body.notes,
    });
    const governanceDecision = await evaluateTradeThesisGovernance(thesis);
    res.json({ thesis: { ...thesis, governanceDecisionId: governanceDecision.id, governanceDecision: governanceDecision.decision }, governanceDecision });
  });

  app.post("/api/trading/theses/:id/governance", isAuthenticated, async (req: any, res) => {
    const thesis = await findUserThesis(userIdFrom(req), req.params.id);
    if (!thesis) return res.status(404).json({ error: "Thesis not found" });
    const governanceDecision = await evaluateTradeThesisGovernance(thesis);
    res.json({ governanceDecision });
  });

  app.patch("/api/trading/theses/:id", isAuthenticated, async (req: any, res) => {
    const thesis = await TradingStore.updateThesis({
      id: req.params.id,
      userId: userIdFrom(req),
      patch: req.body || {},
    });
    if (!thesis) return res.status(404).json({ error: "Thesis not found" });
    res.json({ thesis });
  });

  app.post("/api/trading/theses/:id/archive", isAuthenticated, async (req: any, res) => {
    const thesis = await TradingStore.archiveThesis({ id: req.params.id, userId: userIdFrom(req) });
    if (!thesis) return res.status(404).json({ error: "Thesis not found" });
    res.json({ thesis });
  });
}
