import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { getPolymarketUsStatus, searchPolymarketUsMarkets } from "../zcos/trading/PolymarketUsBridge";
import { userIdFrom } from "./trading-route-helpers";

export function registerTradingPolymarketRoutes(app: Express): void {
  app.get("/api/trading/execution/polymarket/status", isAuthenticated, async (req: any, res) => {
    res.json({ status: await getPolymarketUsStatus(userIdFrom(req)) });
  });

  app.get("/api/trading/execution/polymarket/markets", isAuthenticated, async (req: any, res) => {
    const query = String(req.query.query || "");
    res.json(await searchPolymarketUsMarkets(query));
  });
}
