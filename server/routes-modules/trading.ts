import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import type { PaperTradeStatus } from "../../shared/trading-types";
import { evaluateScannerObservation } from "../zcos/trading/ScannerEngine";
import { createTradeThesis } from "../zcos/trading/TradeThesisEngine";
import { importTradingKnowledge } from "../zcos/trading/TradingKnowledgeBase";
import { TradingStore } from "../zcos/trading/TradingStore";
import { importTradingViewSnapshot } from "../zcos/trading/TradingViewBridge";

function userIdFrom(req: any): string {
  return req.user?.claims?.sub || "unknown";
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requireFields(body: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return field;
    }
  }
  return null;
}

/**
 * Phase 1 Trading Intelligence routes.
 *
 * These endpoints are simulation-only. There is no broker connection,
 * no order transmission, no capital movement, and no live execution.
 */
export function registerTradingRoutes(app: Express): void {
  app.get("/api/trading/phase1/status", isAuthenticated, async (_req, res) => {
    res.json({
      status: "active",
      phase: 1,
      mode: "education-analysis-simulation-only",
      markets: ["stocks", "etfs", "crypto", "forex"],
      restrictions: [
        "No broker connections",
        "No real orders",
        "No live capital movement",
        "Paper trading only",
      ],
    });
  });

  app.get("/api/trading/knowledge", isAuthenticated, async (req, res) => {
    const query = String(req.query.query || "").trim();
    const entries = query
      ? await TradingStore.searchKnowledge(query, 20)
      : await TradingStore.listKnowledge();
    res.json({ entries });
  });

  app.post("/api/trading/knowledge/import", isAuthenticated, async (req, res) => {
    const missing = requireFields(req.body || {}, ["source", "text"]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const entry = await importTradingKnowledge({
      source: String(req.body.source),
      sourceType: req.body.sourceType,
      title: req.body.title,
      text: String(req.body.text),
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    });
    res.json({ entry });
  });

  app.post("/api/trading/tradingview/snapshot", isAuthenticated, async (req, res) => {
    const missing = requireFields(req.body || {}, ["symbol", "assetClass", "timeframe", "notes"]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const entry = await importTradingViewSnapshot({
      symbol: String(req.body.symbol),
      assetClass: req.body.assetClass,
      timeframe: String(req.body.timeframe),
      chartUrl: req.body.chartUrl,
      indicators: Array.isArray(req.body.indicators) ? req.body.indicators : [],
      notes: String(req.body.notes),
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    });
    res.json({ entry });
  });

  app.post("/api/trading/scanner/evaluate", isAuthenticated, async (req, res) => {
    const missing = requireFields(req.body || {}, ["symbol", "assetClass", "timeframe"]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const result = await evaluateScannerObservation({
      symbol: String(req.body.symbol),
      assetClass: req.body.assetClass,
      timeframe: String(req.body.timeframe),
      trend: req.body.trend,
      structureEvent: req.body.structureEvent,
      liquidityEvent: req.body.liquidityEvent,
      confluenceScore: toNumber(req.body.confluenceScore),
      riskReward: req.body.riskReward === undefined ? undefined : toNumber(req.body.riskReward),
      notes: req.body.notes,
    });
    res.json({ result });
  });

  app.get("/api/trading/theses", isAuthenticated, async (req: any, res) => {
    const theses = await TradingStore.listTheses(userIdFrom(req));
    res.json({ theses });
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
      entryPlan: String(req.body.entryPlan),
      stopPlan: String(req.body.stopPlan),
      targetPlan: String(req.body.targetPlan),
      riskReward: req.body.riskReward === undefined ? null : toNumber(req.body.riskReward),
      invalidationConditions: Array.isArray(req.body.invalidationConditions)
        ? req.body.invalidationConditions
        : [String(req.body.invalidationConditions)],
      confidenceScore: toNumber(req.body.confidenceScore, 50),
      status: req.body.status,
      notes: req.body.notes,
    });
    res.json({ thesis });
  });

  app.get("/api/trading/paper-trades", isAuthenticated, async (req: any, res) => {
    const status = req.query.status ? (String(req.query.status) as PaperTradeStatus) : undefined;
    const trades = await TradingStore.listPaperTrades(userIdFrom(req), status);
    res.json({ trades });
  });

  app.post("/api/trading/paper-trades", isAuthenticated, async (req: any, res) => {
    const missing = requireFields(req.body || {}, [
      "market",
      "assetClass",
      "symbol",
      "direction",
      "entry",
      "stop",
      "target",
      "size",
      "riskAmount",
      "entryReason",
    ]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const trade = await TradingStore.openPaperTrade({
      userId: userIdFrom(req),
      thesisId: req.body.thesisId,
      market: String(req.body.market),
      assetClass: req.body.assetClass,
      symbol: String(req.body.symbol).toUpperCase(),
      direction: req.body.direction,
      entry: toNumber(req.body.entry),
      stop: toNumber(req.body.stop),
      target: toNumber(req.body.target),
      size: toNumber(req.body.size),
      riskAmount: toNumber(req.body.riskAmount),
      entryReason: String(req.body.entryReason),
      screenshots: Array.isArray(req.body.screenshots) ? req.body.screenshots : [],
      lessonsLearned: Array.isArray(req.body.lessonsLearned) ? req.body.lessonsLearned : [],
      ruleViolations: Array.isArray(req.body.ruleViolations) ? req.body.ruleViolations : [],
      market: String(req.body.market),
    });
    res.json({ trade });
  });

  app.post("/api/trading/paper-trades/:id/close", isAuthenticated, async (req: any, res) => {
    const missing = requireFields(req.body || {}, ["exitPrice"]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const trade = await TradingStore.closePaperTrade({
      id: req.params.id,
      userId: userIdFrom(req),
      exitPrice: toNumber(req.body.exitPrice),
      exitReason: req.body.exitReason,
      lessonsLearned: Array.isArray(req.body.lessonsLearned) ? req.body.lessonsLearned : [],
      ruleViolations: Array.isArray(req.body.ruleViolations) ? req.body.ruleViolations : [],
    });
    if (!trade) return res.status(404).json({ error: "Paper trade not found" });
    res.json({ trade });
  });

  app.get("/api/trading/performance", isAuthenticated, async (req: any, res) => {
    const report = await TradingStore.getPerformance(userIdFrom(req));
    res.json({ report });
  });
}
