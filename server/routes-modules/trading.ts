import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import type { AuthorizationDecision, PaperTradeStatus } from "../../shared/trading-types";
import { evaluateScannerObservation } from "../zcos/trading/ScannerEngine";
import { createTradeThesis } from "../zcos/trading/TradeThesisEngine";
import {
  authorizePaperTrade,
  evaluateTradeThesisGovernance,
  governanceReview,
} from "../zcos/trading/TradingGovernanceEngine";
import {
  TRADING_BUILD_SEQUENCE,
  TRADING_KNOWLEDGE_AREAS,
  TRADING_SOURCE_LIST,
} from "../zcos/trading/TradingCurriculum";
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

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function requireFields(body: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return field;
    }
  }
  return null;
}

async function findUserThesis(userId: string, thesisId?: unknown) {
  if (!thesisId) return undefined;
  const theses = await TradingStore.listTheses(userId);
  return theses.find((thesis) => thesis.id === String(thesisId));
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
      markets: ["stocks", "etfs", "options", "futures", "crypto", "forex"],
      requiredKnowledgeAreas: TRADING_KNOWLEDGE_AREAS.length,
      buildSteps: TRADING_BUILD_SEQUENCE.length,
      primarySources: TRADING_SOURCE_LIST.map((source) => source.name),
      restrictions: [
        "No broker connections",
        "No real orders",
        "No live capital movement",
        "Paper trading only",
      ],
    });
  });

  app.get("/api/trading/curriculum", isAuthenticated, async (_req, res) => {
    res.json({
      sources: TRADING_SOURCE_LIST,
      knowledgeAreas: TRADING_KNOWLEDGE_AREAS,
      buildSequence: TRADING_BUILD_SEQUENCE,
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
      tags: toArray(req.body.tags),
    });
    res.json({ entry });
  });

  app.post("/api/trading/tradingview/snapshot", isAuthenticated, async (req: any, res) => {
    const missing = requireFields(req.body || {}, ["symbol", "assetClass", "timeframe", "notes"]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const entry = await importTradingViewSnapshot({
      userId: userIdFrom(req),
      symbol: String(req.body.symbol),
      assetClass: req.body.assetClass,
      timeframe: String(req.body.timeframe),
      chartUrl: req.body.chartUrl,
      indicators: toArray(req.body.indicators),
      notes: String(req.body.notes),
      tags: toArray(req.body.tags),
    });
    res.json({ entry });
  });

  app.get("/api/trading/tradingview/records", isAuthenticated, async (req: any, res) => {
    const records = await TradingStore.listTradingViewRecords(userIdFrom(req));
    res.json({ records });
  });

  app.post("/api/trading/tradingview/records", isAuthenticated, async (req: any, res) => {
    const missing = requireFields(req.body || {}, ["type", "symbol", "assetClass", "title", "notes"]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const record = await TradingStore.addTradingViewRecord({
      userId: userIdFrom(req),
      type: req.body.type,
      symbol: String(req.body.symbol).toUpperCase(),
      assetClass: req.body.assetClass,
      timeframe: req.body.timeframe ? String(req.body.timeframe) : undefined,
      title: String(req.body.title),
      status: req.body.status || "active",
      chartUrl: req.body.chartUrl,
      trigger: req.body.trigger,
      notes: String(req.body.notes),
      tags: toArray(req.body.tags),
    });
    res.json({ record });
  });

  app.patch("/api/trading/tradingview/records/:id", isAuthenticated, async (req: any, res) => {
    const record = await TradingStore.updateTradingViewRecord({
      id: req.params.id,
      userId: userIdFrom(req),
      patch: req.body || {},
    });
    if (!record) return res.status(404).json({ error: "TradingView record not found" });
    res.json({ record });
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
      primaryTimeframe: req.body.primaryTimeframe,
      entryPlan: String(req.body.entryPlan),
      stopPlan: String(req.body.stopPlan),
      targetPlan: String(req.body.targetPlan),
      riskReward: req.body.riskReward === undefined ? null : toNumber(req.body.riskReward),
      invalidationConditions: toArray(req.body.invalidationConditions),
      confidenceScore: toNumber(req.body.confidenceScore, 50),
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

  app.get("/api/trading/paper-trades", isAuthenticated, async (req: any, res) => {
    const status = req.query.status ? (String(req.query.status) as PaperTradeStatus) : undefined;
    const trades = await TradingStore.listPaperTrades(userIdFrom(req), status);
    res.json({ trades });
  });

  app.post("/api/trading/paper-trades/authorize", isAuthenticated, async (req: any, res) => {
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

    const thesis = await findUserThesis(userIdFrom(req), req.body.thesisId);
    const authorization = await authorizePaperTrade({
      userId: userIdFrom(req),
      thesis,
      market: String(req.body.market),
      assetClass: req.body.assetClass,
      symbol: String(req.body.symbol),
      direction: req.body.direction,
      timeframe: req.body.timeframe,
      setupName: req.body.setupName,
      entry: toNumber(req.body.entry),
      stop: toNumber(req.body.stop),
      target: toNumber(req.body.target),
      size: toNumber(req.body.size),
      riskAmount: toNumber(req.body.riskAmount),
      entryReason: String(req.body.entryReason),
    });
    res.json(authorization);
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

    const thesis = await findUserThesis(userIdFrom(req), req.body.thesisId);
    const authorization = await authorizePaperTrade({
      userId: userIdFrom(req),
      thesis,
      market: String(req.body.market),
      assetClass: req.body.assetClass,
      symbol: String(req.body.symbol),
      direction: req.body.direction,
      timeframe: req.body.timeframe,
      setupName: req.body.setupName,
      entry: toNumber(req.body.entry),
      stop: toNumber(req.body.stop),
      target: toNumber(req.body.target),
      size: toNumber(req.body.size),
      riskAmount: toNumber(req.body.riskAmount),
      entryReason: String(req.body.entryReason),
    });

    if (!authorization.authorized) {
      return res.status(409).json({
        error: "Paper trade not authorized by governance layer",
        authorization: authorization.decision,
      });
    }

    const trade = await TradingStore.openPaperTrade({
      userId: userIdFrom(req),
      thesisId: req.body.thesisId,
      market: String(req.body.market),
      assetClass: req.body.assetClass,
      symbol: String(req.body.symbol).toUpperCase(),
      direction: req.body.direction,
      timeframe: req.body.timeframe,
      setupName: req.body.setupName,
      entry: toNumber(req.body.entry),
      stop: toNumber(req.body.stop),
      target: toNumber(req.body.target),
      size: toNumber(req.body.size),
      riskAmount: toNumber(req.body.riskAmount),
      entryReason: String(req.body.entryReason),
      screenshots: toArray(req.body.screenshots),
      lessonsLearned: toArray(req.body.lessonsLearned),
      ruleViolations: toArray(req.body.ruleViolations),
      authorizationDecisionId: authorization.decision.id,
      authorizationDecision: authorization.decision.decision as AuthorizationDecision,
    });
    res.json({ trade, authorization: authorization.decision });
  });

  app.post("/api/trading/paper-trades/:id/close", isAuthenticated, async (req: any, res) => {
    const missing = requireFields(req.body || {}, ["exitPrice"]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const trade = await TradingStore.closePaperTrade({
      id: req.params.id,
      userId: userIdFrom(req),
      exitPrice: toNumber(req.body.exitPrice),
      exitReason: req.body.exitReason,
      lessonsLearned: toArray(req.body.lessonsLearned),
      ruleViolations: toArray(req.body.ruleViolations),
    });
    if (!trade) return res.status(404).json({ error: "Paper trade not found" });
    res.json({ trade });
  });

  app.get("/api/trading/performance", isAuthenticated, async (req: any, res) => {
    const report = await TradingStore.getPerformance(userIdFrom(req));
    res.json({ report });
  });

  app.post("/api/trading/governance/review", isAuthenticated, async (req: any, res) => {
    const governanceDecision = await governanceReview(userIdFrom(req));
    res.json({ governanceDecision });
  });

  app.get("/api/trading/governance/decisions", isAuthenticated, async (req: any, res) => {
    const decisions = await TradingStore.listGovernanceDecisions(userIdFrom(req));
    res.json({ decisions });
  });

  app.get("/api/trading/governance/incidents", isAuthenticated, async (req: any, res) => {
    const incidents = await TradingStore.listIncidentReports(userIdFrom(req));
    res.json({ incidents });
  });
}
