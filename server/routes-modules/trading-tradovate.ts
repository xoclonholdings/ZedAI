import type { Express } from "express";

import type { AuthorizationDecision } from "../../shared/trading-types";
import { isAuthenticated } from "../localAuth";
import { getLiveState } from "../zcos/trading/LiveTradingEngine";
import { authorizePaperTrade } from "../zcos/trading/TradingGovernanceEngine";
import { TradingStore } from "../zcos/trading/TradingStore";
import { classifyGovernanceError } from "../services/ErrorContract";
import { zarErrorMessage } from "../../shared/error-contract";
import {
  getTradovateStatus,
  saveTradovateCredentials,
  placeTradovateOrder,
} from "../zcos/trading/TradovateBridge";
import {
  userIdFrom,
  toNumber,
  toArray,
  toManagementStyle,
  requireFields,
  findUserThesis,
} from "./trading-route-helpers";

export function registerTradingTradovateRoutes(app: Express): void {
  app.get("/api/trading/tradovate/status", isAuthenticated, async (req: any, res) => {
    res.json({ status: await getTradovateStatus(userIdFrom(req)) });
  });

  app.post("/api/trading/tradovate/credentials", isAuthenticated, async (req: any, res) => {
    const b = req.body || {};
    await saveTradovateCredentials(userIdFrom(req), {
      environment: b.environment === "live" ? "live" : b.environment === "demo" ? "demo" : undefined,
      username: b.username ? String(b.username) : undefined,
      password: b.password ? String(b.password) : undefined,
      appId: b.appId ? String(b.appId) : undefined,
      cid: b.cid ? String(b.cid) : undefined,
      sec: b.sec ? String(b.sec) : undefined,
      deviceId: b.deviceId ? String(b.deviceId) : undefined,
    });
    res.json({ status: await getTradovateStatus(userIdFrom(req)) });
  });

  /**
   * Place an order through Tradovate. Demo (paper) orders and LIVE orders
   * both go through the same governance checklist every other execution
   * path uses (risk amount, stop/target math, rule checks) — a real
   * broker order should never skip the checks a purely-internal paper
   * trade would have to pass. LIVE orders additionally require the
   * Live-stage gates (qualification passed, kill switch armed). Every
   * accepted order — demo or live — is recorded in TradingStore exactly
   * like every other trade, so it counts toward external-paper
   * validation, performance analytics, and review reports instead of
   * vanishing the moment Tradovate accepts it.
   */
  app.post("/api/trading/tradovate/order", isAuthenticated, async (req: any, res) => {
    const userId = userIdFrom(req);
    const status = await getTradovateStatus(userId);
    if (!status.connected) {
      return res.status(409).json({ error: status.note || "Tradovate is not connected." });
    }
    if (status.environment === "live") {
      const live = await getLiveState(userId);
      if (!live.canExecute) {
        return res.status(403).json({
          error: `Live order blocked by governance: ${live.blockers.join(" ")}`,
        });
      }
    }
    const b = req.body || {};
    const missing = requireFields(b, [
      "accountId",
      "accountSpec",
      "action",
      "symbol",
      "orderQty",
      "market",
      "assetClass",
      "direction",
      "entry",
      "stop",
      "target",
      "size",
      "riskAmount",
      "entryReason",
    ]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const thesis = await findUserThesis(userId, b.thesisId);
    const authorization = await authorizePaperTrade({
      userId,
      thesis,
      market: String(b.market),
      assetClass: b.assetClass,
      symbol: String(b.symbol),
      direction: b.direction,
      timeframe: b.timeframe,
      setupName: b.setupName,
      entry: toNumber(b.entry),
      stop: toNumber(b.stop),
      target: toNumber(b.target),
      size: toNumber(b.size),
      riskAmount: toNumber(b.riskAmount),
      entryReason: String(b.entryReason),
      session: b.session ? String(b.session) : undefined,
      newsContext: b.newsContext ? String(b.newsContext) : undefined,
      correlationNotes: b.correlationNotes ? String(b.correlationNotes) : undefined,
    });

    if (!authorization.authorized) {
      const errorDetail = classifyGovernanceError(authorization.decision.checklist);
      return res.status(409).json({
        error: zarErrorMessage(errorDetail, "Tradovate order not authorized by governance layer"),
        errorDetail,
        authorization: authorization.decision,
      });
    }

    const result = await placeTradovateOrder(userId, {
      accountId: toNumber(b.accountId),
      accountSpec: String(b.accountSpec),
      action: b.action === "Sell" ? "Sell" : "Buy",
      symbol: String(b.symbol),
      orderQty: toNumber(b.orderQty),
      orderType: b.orderType === "Limit" ? "Limit" : "Market",
      price: b.price === undefined ? undefined : toNumber(b.price),
    });
    if ("error" in result) {
      return res.status(502).json({ error: `Tradovate did not accept the order: ${result.error}` });
    }

    const trade = await TradingStore.openPaperTrade({
      userId,
      thesisId: b.thesisId,
      market: String(b.market),
      assetClass: b.assetClass,
      symbol: String(b.symbol).toUpperCase(),
      direction: b.direction,
      timeframe: b.timeframe,
      setupName: b.setupName || `Tradovate ${status.environment} order`,
      entry: toNumber(b.entry),
      stop: toNumber(b.stop),
      target: toNumber(b.target),
      size: toNumber(b.size),
      riskAmount: toNumber(b.riskAmount),
      managementStyle: toManagementStyle(b.managementStyle),
      entryReason: String(b.entryReason),
      screenshots: toArray(b.screenshots),
      lessonsLearned: toArray(b.lessonsLearned),
      ruleViolations: toArray(b.ruleViolations),
      authorizationDecisionId: authorization.decision.id,
      authorizationDecision: authorization.decision.decision as AuthorizationDecision,
      executionMode: status.environment === "live" ? "live" : "external_paper",
      executionProvider: "tradovate",
      externalOrderId: String(result.orderId),
      externalOrderStatus: "submitted",
      externalNote: `Tradovate accepted the order (id ${result.orderId}).`,
    });

    res.json({ trade, orderId: result.orderId, environment: status.environment, authorization: authorization.decision });
  });
}
