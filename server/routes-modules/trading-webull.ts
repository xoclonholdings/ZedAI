import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import type { AuthorizationDecision } from "../../shared/trading-types";
import { proposeTrade, webullTradeDataAdapter } from "../zcos/trading/TradeProposalService";
import { authorizePaperTrade } from "../zcos/trading/TradingGovernanceEngine";
import { TradingStore } from "../zcos/trading/TradingStore";
import { getExternalPaperReport } from "../zcos/trading/ExternalPaperEngine";
import { getPolymarketUsStatus } from "../zcos/trading/PolymarketUsBridge";
import {
  getWebullStatus,
  listWebullAccounts,
  listWebullOrders,
  listWebullPositions,
  placeWebullPaperOrder,
  placeWebullLiveOrder,
  saveWebullCredentials,
  testWebullConnection,
} from "../zcos/trading/WebullBridge";
import { classifyGovernanceError } from "../services/ErrorContract";
import { zarErrorMessage } from "../../shared/error-contract";
import {
  userIdFrom,
  toNumber,
  toArray,
  toManagementStyle,
  requireFields,
  findUserThesis,
} from "./trading-route-helpers";

/** Execution-adapter discovery plus the Webull execution bridge. */
export function registerTradingWebullRoutes(app: Express): void {
  /* ---- Execution adapters (readiness + read-only discovery) ---- */
  app.get("/api/trading/execution/adapters", isAuthenticated, async (req: any, res) => {
    const userId = userIdFrom(req);
    const [webull, polymarket] = await Promise.all([
      getWebullStatus(userId),
      getPolymarketUsStatus(userId),
    ]);
    res.json({ adapters: [webull, polymarket] });
  });

  app.get("/api/trading/execution/webull/status", isAuthenticated, async (req: any, res) => {
    res.json({ status: await getWebullStatus(userIdFrom(req)) });
  });

  /* ---- Webull execution bridge ---- */
  app.get("/api/trading/webull/status", isAuthenticated, async (req: any, res) => {
    res.json({ status: await getWebullStatus(userIdFrom(req)) });
  });

  app.post("/api/trading/webull/credentials", isAuthenticated, async (req: any, res) => {
    try {
      const b = req.body || {};
      const status = await saveWebullCredentials(userIdFrom(req), {
        appKey: b.appKey ? String(b.appKey) : undefined,
        appSecret: b.appSecret ? String(b.appSecret) : undefined,
        endpoint: b.endpoint ? String(b.endpoint) : undefined,
        accountId: b.accountId ? String(b.accountId) : undefined,
        environment: b.environment ? String(b.environment) : undefined,
        accessToken: b.accessToken ? String(b.accessToken) : undefined,
      });
      res.json({ status });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Could not save Webull connection." });
    }
  });

  app.post("/api/trading/webull/test", isAuthenticated, async (req: any, res) => {
    const result = await testWebullConnection(userIdFrom(req));
    res.status(result.ok ? 200 : 502).json({ result, status: await getWebullStatus(userIdFrom(req)) });
  });

  app.get("/api/trading/webull/accounts", isAuthenticated, async (req: any, res) => {
    res.json(await listWebullAccounts(userIdFrom(req)));
  });

  app.get("/api/trading/webull/positions", isAuthenticated, async (req: any, res) => {
    res.json(await listWebullPositions(userIdFrom(req)));
  });

  app.get("/api/trading/webull/orders", isAuthenticated, async (req: any, res) => {
    res.json(await listWebullOrders(userIdFrom(req)));
  });

  app.post("/api/trading/webull/propose", isAuthenticated, async (req: any, res) => {
    try {
      const userId = userIdFrom(req);
      const status = await getWebullStatus(userId);
      if (!status.connected) {
        return res.status(409).json({
          error: status.note || "Webull paper account is not connected.",
          status,
        });
      }

      const asset = req.body.asset || req.body.assetClass || "stock";
      const market = req.body.market ? String(req.body.market) : "US";
      const recentTrades = await TradingStore.listPaperTrades(userId);
      const avoidSymbols = recentTrades
        .filter((trade) => trade.executionMode === "external_paper")
        .slice(0, 12)
        .map((trade) => trade.symbol);

      const result = await proposeTrade({
        userId,
        adapter: webullTradeDataAdapter(userId),
        asset,
        market,
        symbol: req.body.symbol ? String(req.body.symbol) : undefined,
        directionPreference: req.body.directionPreference || "auto",
        timeframe: req.body.timeframe ? String(req.body.timeframe) : undefined,
        avoidSymbols,
        notesPrefix: "Webull external paper proposal.",
      });

      if (result.kind === "error") return res.status(result.statusCode).json({ action: "no_trade", error: result.error });
      if (result.kind === "no_trade") {
        return res.json({
          action: "no_trade",
          symbol: result.symbol,
          marketData: result.marketData,
          signal: result.signal,
          reason: result.reason,
          status,
        });
      }
      res.json({
        action: result.strategy.direction === "long" ? "buy" : "sell",
        ...result.strategy,
        thesisId: result.thesisId,
        managementStyle: "bracket",
        marketData: result.marketData,
        signal: result.signal,
        recommendedSymbol: result.recommendedSymbol,
        status,
      });
    } catch (error: any) {
      const message = error?.message || "Webull trade proposal failed";
      const statusCode = String(message).toLowerCase().includes("webull") ? 422 : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  app.post("/api/trading/webull/paper-orders", isAuthenticated, async (req: any, res) => {
    const userId = userIdFrom(req);
    const status = await getWebullStatus(userId);
    if (!status.connected) {
      return res.status(409).json({
        error: status.note || "Webull paper account is not connected.",
        status,
      });
    }

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

    const thesis = await findUserThesis(userId, req.body.thesisId);
    const authorization = await authorizePaperTrade({
      userId,
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
        error: zarErrorMessage(errorDetail, "Webull paper order not authorized by governance layer"),
        errorDetail,
        authorization: authorization.decision,
      });
    }

    // Place the REAL order on Webull's SANDBOX account — a trade is only
    // logged with the platform's actual response; a rejection is
    // surfaced, never staged. placeWebullPaperOrder refuses outright if
    // this connection resolves to production, so "paper trading" can
    // never accidentally execute on the funded account.
    const order = await placeWebullPaperOrder(userId, {
      symbol: String(req.body.symbol).toUpperCase(),
      side: req.body.direction === "short" ? "SELL" : "BUY",
      quantity: toNumber(req.body.size) || 1,
      orderType: "LIMIT",
      limitPrice: toNumber(req.body.entry),
    });
    if (!order.ok) {
      return res.status(502).json({
        error: `Webull did not accept the order: ${order.message}`,
        webullOrder: order,
      });
    }

    const trade = await TradingStore.openPaperTrade({
      userId,
      thesisId: req.body.thesisId,
      market: String(req.body.market),
      assetClass: req.body.assetClass,
      symbol: String(req.body.symbol).toUpperCase(),
      direction: req.body.direction,
      timeframe: req.body.timeframe,
      setupName: req.body.setupName || "Webull paper order",
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
      executionMode: "external_paper",
      executionProvider: "webull",
      externalOrderId: order.orderId || order.clientOrderId,
      externalOrderStatus: order.ok ? "submitted" : "rejected",
      externalNote: order.message,
    });

    res.json({
      trade,
      webullOrder: order,
      authorization: authorization.decision,
      status: await getWebullStatus(userId),
      report: await getExternalPaperReport(userId),
    });
  });

  /**
   * Place a REAL order on the connected Webull FUNDED account. This is
   * the live-execution path — separate from /webull/paper-orders above,
   * which only ever runs against sandbox. placeWebullLiveOrder refuses
   * outright unless this connection resolves to production AND every
   * Live-stage governance gate (qualification passed, kill switch armed)
   * is satisfied — mirroring the same gate the Tradovate live order
   * route enforces in trading-tradovate.ts.
   */
  app.post("/api/trading/webull/order", isAuthenticated, async (req: any, res) => {
    const userId = userIdFrom(req);
    const status = await getWebullStatus(userId);
    if (!status.connected) {
      return res.status(409).json({ error: status.note || "Webull is not connected." });
    }

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

    const order = await placeWebullLiveOrder(userId, {
      symbol: String(req.body.symbol).toUpperCase(),
      side: req.body.direction === "short" ? "SELL" : "BUY",
      quantity: toNumber(req.body.size) || 1,
      orderType: "LIMIT",
      limitPrice: toNumber(req.body.entry),
    });
    if (!order.ok) {
      return res.status(403).json({
        error: `Webull did not accept the live order: ${order.message}`,
        webullOrder: order,
      });
    }

    // A live trade gets the same permanent, reviewable record every
    // other trade does — governance and audit don't stop once ZAR is
    // trading the real account.
    const trade = await TradingStore.openPaperTrade({
      userId,
      thesisId: req.body.thesisId,
      market: String(req.body.market),
      assetClass: req.body.assetClass,
      symbol: String(req.body.symbol).toUpperCase(),
      direction: req.body.direction,
      timeframe: req.body.timeframe,
      setupName: req.body.setupName || "Webull live order",
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
      executionMode: "live",
      executionProvider: "webull",
      externalOrderId: order.orderId || order.clientOrderId,
      externalOrderStatus: order.ok ? "submitted" : "rejected",
      externalNote: order.message,
    });

    res.json({ trade, webullOrder: order, status: await getWebullStatus(userId) });
  });
}
