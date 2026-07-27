import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import {
  getEvaluationReport,
  saveEvaluationConfig,
  startEvaluation,
  resetEvaluation,
} from "../zcos/trading/EvaluationEngine";
import { getExternalPaperReport } from "../zcos/trading/ExternalPaperEngine";
import { getQualificationReport } from "../zcos/trading/QualificationEngine";
import { getLiveState, saveLiveConfig, setKillSwitch } from "../zcos/trading/LiveTradingEngine";
import { userIdFrom, toNumber } from "./trading-route-helpers";

/** Progression stages beyond paper trading: external paper, evaluation, qualification, live. */
export function registerTradingStagesRoutes(app: Express): void {
  /* ---- Stage 5: External paper trading ---- */
  app.get("/api/trading/external-paper", isAuthenticated, async (req: any, res) => {
    res.json({ report: await getExternalPaperReport(userIdFrom(req)) });
  });

  /* ---- Stage 6: Funded account (evaluation) ---- */
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
