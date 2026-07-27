import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { getLiveState } from "../zcos/trading/LiveTradingEngine";
import {
  getTradovateStatus,
  saveTradovateCredentials,
  placeTradovateOrder,
} from "../zcos/trading/TradovateBridge";
import { userIdFrom, toNumber, requireFields } from "./trading-route-helpers";

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
   * Place an order through Tradovate. Demo (paper) orders are allowed once
   * connected; LIVE orders additionally require the governance gates —
   * qualification passed and the kill switch armed — so Zed can't route a
   * real order until it earned the right to.
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
    const missing = requireFields(b, ["accountId", "accountSpec", "action", "symbol", "orderQty"]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const result = await placeTradovateOrder(userId, {
      accountId: toNumber(b.accountId),
      accountSpec: String(b.accountSpec),
      action: b.action === "Sell" ? "Sell" : "Buy",
      symbol: String(b.symbol),
      orderQty: toNumber(b.orderQty),
      orderType: b.orderType === "Limit" ? "Limit" : "Market",
      price: b.price === undefined ? undefined : toNumber(b.price),
    });
    if ("error" in result) return res.status(502).json({ error: result.error });
    res.json({ orderId: result.orderId, environment: status.environment });
  });
}
