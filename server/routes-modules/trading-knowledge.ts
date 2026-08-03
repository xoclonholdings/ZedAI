import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { evaluateScannerObservation } from "../zcos/trading/ScannerEngine";
import {
  TRADING_BUILD_SEQUENCE,
  TRADING_KNOWLEDGE_AREAS,
  TRADING_SOURCE_LIST,
} from "../zcos/trading/TradingCurriculum";
import { importTradingKnowledge } from "../zcos/trading/TradingKnowledgeBase";
import { TradingStore } from "../zcos/trading/TradingStore";
import { toArray, toNumber, requireFields } from "./trading-route-helpers";

/**
 * Phase 1 Trading Intelligence knowledge/curriculum routes.
 *
 * These endpoints are simulation-only. There is no broker connection,
 * no order transmission, no capital movement, and no live execution.
 */
export function registerTradingKnowledgeRoutes(app: Express): void {
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

  app.post("/api/trading/scanner/evaluate", isAuthenticated, async (req, res) => {
    const missing = requireFields(req.body || {}, ["symbol", "assetClass"]);
    if (missing) return res.status(400).json({ error: `${missing} is required` });

    const result = await evaluateScannerObservation({
      symbol: String(req.body.symbol),
      assetClass: req.body.assetClass,
      timeframe: req.body.timeframe ? String(req.body.timeframe) : undefined,
      riskReward: req.body.riskReward === undefined ? undefined : toNumber(req.body.riskReward),
      notes: req.body.notes,
    });
    res.json({ result });
  });
}
