import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { getMarketQuote, getMarketDataStatus, getMultiTimeframeSeries } from "../zcos/trading/MarketDataService";
import { runBacktest } from "../zcos/trading/BacktestEngine";
import { tradingDbAvailable } from "../zcos/trading/tradingPersistence";
import {
  marketDataKeyStatus,
  saveMarketDataKeys,
  clearMarketDataKey,
  type MarketDataVendor,
} from "../zcos/trading/MarketDataKeysStore";
import { analyzeMarketStructure, generateStructureAlerts } from "../zcos/trading/MarketStructureEngine";
import { TradingStore } from "../zcos/trading/TradingStore";
import { userIdFrom, toNumber } from "./trading-route-helpers";

/** Live market data, data-vendor keys, storage status, and backtesting. */
export function registerTradingMarketDataRoutes(app: Express): void {
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

  /** Backtest ZAR's signal strategy over a symbol's price history. */
  app.post("/api/trading/backtest", isAuthenticated, async (req: any, res) => {
    const symbol = String((req.body || {}).symbol || "").trim();
    if (!symbol) return res.status(400).json({ error: "symbol is required" });
    const report = await runBacktest({
      symbol,
      asset: (req.body.asset || "stock") as any,
      range: req.body.range ? String(req.body.range) : undefined,
      riskReward: req.body.riskReward === undefined ? undefined : toNumber(req.body.riskReward),
      signalThreshold:
        req.body.signalThreshold === undefined ? undefined : toNumber(req.body.signalThreshold),
      slippageBps: req.body.slippageBps === undefined ? undefined : toNumber(req.body.slippageBps),
      commissionR: req.body.commissionR === undefined ? undefined : toNumber(req.body.commissionR),
    });
    if (!report) {
      return res.status(422).json({
        error: "Not enough price history was reachable to backtest this symbol.",
      });
    }
    res.json({ report });
  });

  /** Technical buy/sell signal for a symbol from live indicators. */
  app.get("/api/trading/market-data/signal", isAuthenticated, async (req: any, res) => {
    const symbol = String(req.query.symbol || "").trim();
    if (!symbol) return res.status(400).json({ error: "symbol is required" });
    const asset = (req.query.asset ? String(req.query.asset) : "stock") as any;
    const quote = await getMarketQuote(symbol, asset);
    if (!quote) {
      return res.json({ live: false, signal: null, note: "No live market-data source is reachable." });
    }
    res.json({
      live: true,
      price: quote.price,
      source: quote.source,
      asOf: quote.asOf,
      signal: quote.signal ?? null,
    });
  });

  /** Live quote lookup ZAR and the UI use to show real prices. */
  app.get("/api/trading/market-data/quote", isAuthenticated, async (req: any, res) => {
    const symbol = String(req.query.symbol || "").trim();
    if (!symbol) return res.status(400).json({ error: "symbol is required" });
    const asset = (req.query.asset ? String(req.query.asset) : "stock") as any;
    const quote = await getMarketQuote(symbol, asset);
    if (!quote) {
      return res.json({
        live: false,
        quote: null,
        note: "No live market-data source is reachable from the server right now. ZAR will use a paper reference until a data feed or API key is available.",
      });
    }
    res.json({ live: true, quote });
  });

  /**
   * Real market structure for a symbol — swings, structural events
   * (BOS/CHoCH/MSS), liquidity, institutional footprints, price
   * interaction, multi-timeframe alignment, and a single confluence
   * score, all computed from live bars by the Market Structure Engine.
   * Also diffs against the last computed snapshot for this symbol and
   * records any new intelligent alerts (structure shift, liquidity
   * sweep, high-confluence zone, major order block test, trend reversal,
   * multi-timeframe alignment) for later retrieval.
   */
  app.get("/api/trading/market-data/structure", isAuthenticated, async (req: any, res) => {
    const symbol = String(req.query.symbol || "").trim();
    if (!symbol) return res.status(400).json({ error: "symbol is required" });
    const asset = (req.query.asset ? String(req.query.asset) : "stock") as any;
    const primaryTimeframe = req.query.timeframe ? String(req.query.timeframe) : "Daily";

    const [series, quote] = await Promise.all([
      getMultiTimeframeSeries(symbol, asset),
      getMarketQuote(symbol, asset),
    ]);

    if (!series.length) {
      return res.json({
        live: false,
        structure: null,
        note: "No live price history is reachable for this symbol right now, so market structure can't be read.",
      });
    }

    const structure = analyzeMarketStructure(symbol, series, primaryTimeframe, quote?.signal);
    if (!structure) {
      return res.json({ live: true, structure: null, note: "Not enough bars were available to detect structure." });
    }

    const userId = userIdFrom(req);
    const previous = await TradingStore.getLastStructureSnapshot(symbol);
    const alerts = generateStructureAlerts(userId, structure, previous);
    await TradingStore.saveStructureSnapshot(structure);
    if (alerts.length) await TradingStore.addStructureAlerts(alerts);

    res.json({ live: true, structure, newAlerts: alerts });
  });

  /** Recently generated structure alerts (structure shifts, sweeps, high-confluence zones, …). */
  app.get("/api/trading/market-data/alerts", isAuthenticated, async (req: any, res) => {
    const limit = req.query.limit ? Math.max(1, Math.min(200, toNumber(req.query.limit, 50))) : 50;
    const alerts = await TradingStore.listStructureAlerts(userIdFrom(req), limit);
    res.json({ alerts });
  });
}
