import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import type { AuthorizationDecision, PaperTradeStatus } from "../../shared/trading-types";
import { evaluateScannerObservation } from "../zcos/trading/ScannerEngine";
import { createTradeThesis } from "../zcos/trading/TradeThesisEngine";
import { generateTradeStrategy } from "../zcos/trading/TradeStrategyGenerator";
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
import { getMarketQuote, getMarketDataStatus } from "../zcos/trading/MarketDataService";
import { resolveOpenPaperTrades } from "../zcos/trading/TradeAutoResolver";
import { recommendSymbol } from "../zcos/trading/SymbolRecommender";
import { tradingDbAvailable } from "../zcos/trading/tradingPersistence";
import {
  getEvaluationReport,
  saveEvaluationConfig,
  startEvaluation,
  resetEvaluation,
} from "../zcos/trading/EvaluationEngine";
import { getQualificationReport } from "../zcos/trading/QualificationEngine";
import { getLiveState, saveLiveConfig, setKillSwitch } from "../zcos/trading/LiveTradingEngine";
import {
  marketDataKeyStatus,
  saveMarketDataKeys,
  clearMarketDataKey,
  type MarketDataVendor,
} from "../zcos/trading/MarketDataKeysStore";

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
   * Zed proposes a COMPLETE paper trade the user can approve in one tap.
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

      // Zed can pick the symbol when the user doesn't supply one.
      let symbol = String(req.body.symbol || "").trim();
      let directionPreference = req.body.directionPreference || "auto";
      let recommendation: Awaited<ReturnType<typeof recommendSymbol>> = null;
      if (!symbol) {
        recommendation = await recommendSymbol(asset, market);
        if (!recommendation) {
          return res.status(422).json({
            error:
              "Zed couldn't reach live data to pick a symbol. Enter a symbol, or add a market-data API key.",
          });
        }
        symbol = recommendation.symbol;
        if (directionPreference === "auto") directionPreference = recommendation.direction;
      }

      // Pull a live quote so Zed prices the setup off real levels. A user-
      // supplied referencePrice always wins; otherwise the live price is
      // used, and the live ATR sizes the stop to real volatility. If no
      // source is reachable, the generator falls back to a paper reference.
      const overridePrice =
        req.body.referencePrice === undefined ? undefined : toNumber(req.body.referencePrice);
      const quote = await getMarketQuote(symbol, asset);
      const referencePrice = overridePrice ?? quote?.price;

      const strategy = await generateTradeStrategy({
        userId,
        symbol,
        asset,
        market,
        directionPreference,
        timeframe: req.body.timeframe ? String(req.body.timeframe) : undefined,
        referencePrice,
        stopDistance: quote?.atr,
      });

      const marketData = quote
        ? { live: true, source: quote.source, price: quote.price, asOf: quote.asOf, atr: quote.atr ?? null }
        : { live: false, source: null, price: null, asOf: null, atr: null };

      const thesis = await createTradeThesis({
        userId,
        market,
        assetClass: asset,
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
        notes: strategy.basis,
      });

      res.json({
        ...strategy,
        thesisId: thesis.id,
        session: strategy.session,
        marketData,
        recommendedSymbol: recommendation
          ? { symbol: recommendation.symbol, reason: recommendation.reason }
          : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Trade proposal failed" });
    }
  });

  /** Zed recommends a symbol to trade from live data (no symbol needed). */
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

  /** Whether trading data is persisting durably (survives logout/redeploy). */
  app.get("/api/trading/storage-status", isAuthenticated, async (_req, res) => {
    const durable = tradingDbAvailable();
    res.json({
      durable,
      note: durable
        ? "Trading data is saved to your account database — it survives logout and redeploys."
        : "No database is connected, so trading data is only kept on the server disk and will be lost on redeploy. Set DATABASE_URL to persist.",
    });
  });

  /** Self-report whether the server can reach a live feed right now. */
  app.get("/api/trading/market-data/status", isAuthenticated, async (_req, res) => {
    const status = await getMarketDataStatus();
    res.json(status);
  });

  /** Which data-vendor API keys are configured (never returns the key). */
  app.get("/api/trading/market-data/keys", isAuthenticated, async (_req, res) => {
    const keys = await marketDataKeyStatus();
    res.json({ keys });
  });

  /** Save data-vendor API keys the user enters in the app. */
  app.post("/api/trading/market-data/keys", isAuthenticated, async (req: any, res) => {
    const body = req.body || {};
    await saveMarketDataKeys({
      finnhub: body.finnhub ? String(body.finnhub) : undefined,
      alphavantage: body.alphavantage ? String(body.alphavantage) : undefined,
      twelvedata: body.twelvedata ? String(body.twelvedata) : undefined,
    });
    const keys = await marketDataKeyStatus();
    res.json({ keys });
  });

  /** Remove one saved key (falls back to env after this). */
  app.delete("/api/trading/market-data/keys/:vendor", isAuthenticated, async (req: any, res) => {
    const vendor = String(req.params.vendor) as MarketDataVendor;
    if (!["finnhub", "alphavantage", "twelvedata"].includes(vendor)) {
      return res.status(400).json({ error: "Unknown vendor" });
    }
    await clearMarketDataKey(vendor);
    const keys = await marketDataKeyStatus();
    res.json({ keys });
  });

  /** Live quote lookup Zed and the UI use to show real prices. */
  app.get("/api/trading/market-data/quote", isAuthenticated, async (req: any, res) => {
    const symbol = String(req.query.symbol || "").trim();
    if (!symbol) return res.status(400).json({ error: "symbol is required" });
    const asset = (req.query.asset ? String(req.query.asset) : "stock") as any;
    const quote = await getMarketQuote(symbol, asset);
    if (!quote) {
      return res.json({
        live: false,
        quote: null,
        note: "No live market-data source is reachable from the server right now. Zed will use a paper reference until a data feed or API key is available.",
      });
    }
    res.json({ live: true, quote });
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
      session: req.body.session ? String(req.body.session) : undefined,
      newsContext: req.body.newsContext ? String(req.body.newsContext) : undefined,
      correlationNotes: req.body.correlationNotes ? String(req.body.correlationNotes) : undefined,
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
      session: req.body.session ? String(req.body.session) : undefined,
      newsContext: req.body.newsContext ? String(req.body.newsContext) : undefined,
      correlationNotes: req.body.correlationNotes ? String(req.body.correlationNotes) : undefined,
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

  /**
   * Check open paper trades against live prices and auto-close any that
   * have hit their target (win) or stop (loss). This is how Zed's proposals
   * are proven objectively over the validation sample.
   */
  app.post("/api/trading/paper-trades/resolve", isAuthenticated, async (req: any, res) => {
    const result = await resolveOpenPaperTrades(userIdFrom(req));
    res.json(result);
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

  /* ---- Stage 5: External evaluation ---- */
  app.get("/api/trading/evaluation", isAuthenticated, async (req: any, res) => {
    res.json({ report: await getEvaluationReport(userIdFrom(req)) });
  });

  app.patch("/api/trading/evaluation/config", isAuthenticated, async (req: any, res) => {
    const b = req.body || {};
    const patch: Record<string, unknown> = {};
    for (const k of ["startingBalance", "profitTarget", "maxDailyLoss", "maxTotalDrawdown", "minTradingDays"]) {
      if (b[k] !== undefined) patch[k] = toNumber(b[k]);
    }
    if (b.provider) patch.provider = String(b.provider);
    await saveEvaluationConfig(userIdFrom(req), patch);
    res.json({ report: await getEvaluationReport(userIdFrom(req)) });
  });

  app.post("/api/trading/evaluation/start", isAuthenticated, async (req: any, res) => {
    res.json({ report: await startEvaluation(userIdFrom(req)) });
  });

  app.post("/api/trading/evaluation/reset", isAuthenticated, async (req: any, res) => {
    res.json({ report: await resetEvaluation(userIdFrom(req)) });
  });

  /* ---- Stage 6: Qualification ---- */
  app.get("/api/trading/qualification", isAuthenticated, async (req: any, res) => {
    res.json({ report: await getQualificationReport(userIdFrom(req)) });
  });

  /* ---- Stage 7: Live trading (governed) ---- */
  app.get("/api/trading/live", isAuthenticated, async (req: any, res) => {
    res.json({ state: await getLiveState(userIdFrom(req)) });
  });

  app.patch("/api/trading/live/config", isAuthenticated, async (req: any, res) => {
    const b = req.body || {};
    const patch: Record<string, unknown> = {};
    for (const k of ["maxRiskPerTrade", "maxDailyLoss", "maxTotalDrawdown"]) {
      if (b[k] !== undefined) patch[k] = toNumber(b[k]);
    }
    await saveLiveConfig(userIdFrom(req), patch);
    res.json({ state: await getLiveState(userIdFrom(req)) });
  });

  app.post("/api/trading/live/kill-switch", isAuthenticated, async (req: any, res) => {
    const armed = Boolean((req.body || {}).armed);
    res.json({ state: await setKillSwitch(userIdFrom(req), armed) });
  });
}
