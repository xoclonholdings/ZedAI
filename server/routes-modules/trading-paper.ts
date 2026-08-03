import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import type {
  AuthorizationDecision,
  PaperTradeStatus,
  PaperTradingGovernanceSettings,
} from "../../shared/trading-types";
import { authorizePaperTrade, governanceReview } from "../zcos/trading/TradingGovernanceEngine";
import { TradingStore } from "../zcos/trading/TradingStore";
import { resolveOpenPaperTrades } from "../zcos/trading/TradeAutoResolver";
import { placeWebullOrder } from "../zcos/trading/WebullBridge";
import { classifyGovernanceError } from "../services/ErrorContract";
import { zarErrorMessage } from "../../shared/error-contract";
import {
  userIdFrom,
  toNumber,
  toArray,
  toGovernanceMode,
  toManagementStyle,
  requireFields,
  findUserThesis,
  type PaperGovernanceSettingsPatch,
} from "./trading-route-helpers";

/** Paper-trade lifecycle (authorize/open/resolve/close) and governance settings. */
export function registerTradingPaperRoutes(app: Express): void {
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
      const errorDetail = classifyGovernanceError(authorization.decision.checklist);
      return res.status(409).json({
        error: zarErrorMessage(errorDetail, "Paper trade not authorized by governance layer"),
        errorDetail,
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
      setupName: req.body.setupName || thesis?.setupType,
      entry: toNumber(req.body.entry),
      stop: toNumber(req.body.stop),
      target: toNumber(req.body.target),
      size: toNumber(req.body.size),
      riskAmount: toNumber(req.body.riskAmount),
      managementStyle: toManagementStyle(req.body.managementStyle),
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
   * have hit their target (win) or stop (loss). This is how ZAR's proposals
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

    // If the entry filled on Webull, flatten the position there too.
    let webullOrder;
    if (trade.executionProvider === "webull" && trade.externalOrderStatus === "submitted") {
      webullOrder = await placeWebullOrder(userIdFrom(req), {
        symbol: trade.symbol,
        side: trade.direction === "short" ? "BUY" : "SELL",
        quantity: trade.size || 1,
        orderType: "LIMIT",
        limitPrice: toNumber(req.body.exitPrice),
      });
    }
    res.json({ trade, webullOrder });
  });

  app.get("/api/trading/performance", isAuthenticated, async (req: any, res) => {
    const report = await TradingStore.getPerformance(userIdFrom(req));
    res.json({ report });
  });

  app.post("/api/trading/governance/review", isAuthenticated, async (req: any, res) => {
    const governanceDecision = await governanceReview(userIdFrom(req));
    res.json({ governanceDecision });
  });

  app.get("/api/trading/governance/paper-settings", isAuthenticated, async (req: any, res) => {
    const settings = await TradingStore.getPaperGovernanceSettings(userIdFrom(req));
    res.json({ settings });
  });

  app.patch("/api/trading/governance/paper-settings", isAuthenticated, async (req: any, res) => {
    const body = req.body || {};
    const patch: PaperGovernanceSettingsPatch = {};
    const mode = toGovernanceMode(body.mode);
    if (mode) patch.mode = mode;
    if (body.checks && typeof body.checks === "object") patch.checks = body.checks;
    if (body.thresholds && typeof body.thresholds === "object") {
      const thresholds: Partial<PaperTradingGovernanceSettings["thresholds"]> = {};
      for (const key of ["minimumRiskReward", "maxRiskPerPaperTrade", "maxNegativeDrawdown", "requiredSampleSize"]) {
        if (body.thresholds[key] !== undefined) {
          thresholds[key as keyof PaperTradingGovernanceSettings["thresholds"]] = toNumber(body.thresholds[key]);
        }
      }
      patch.thresholds = thresholds;
    }
    const settings = await TradingStore.updatePaperGovernanceSettings(userIdFrom(req), patch);
    res.json({ settings });
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
