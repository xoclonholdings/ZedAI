import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import {
  loadProgression,
  setCurrentStage,
  unlockStage,
  updateStageProgress,
} from "../services/TradingProgressionStore";
import type { TradingStageId } from "../../shared/trading-progression";
import { TRADING_STAGES } from "../../shared/trading-progression";

/**
 * REST surface for the trader's 7-stage progression.
 *
 * Kept intentionally minimal — read the current progression, mark
 * stage progress, unlock a stage, or set the current stage. The
 * shape of the stages themselves lives in
 * shared/trading-progression.ts and is served alongside the
 * per-user state so the frontend never diverges from the model.
 */
export function registerTradingProgressionRoutes(app: Express): void {
  app.get("/api/trading/progression", isAuthenticated, async (req: any, res) => {
    try {
      const progression = await loadProgression(req.user.claims.sub);
      res.json({ progression, stages: TRADING_STAGES });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load progression" });
    }
  });

  app.patch(
    "/api/trading/progression/stages/:stageId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const stageId = req.params.stageId as TradingStageId;
        if (!TRADING_STAGES.some((s) => s.id === stageId)) {
          return res.status(400).json({ error: "Unknown stage" });
        }
        const { completionPercent, notes, markStarted, markCompleted } = req.body || {};
        const next = await updateStageProgress(req.user.claims.sub, stageId, {
          completionPercent,
          notes,
          markStarted,
          markCompleted,
        });
        res.json(next);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "Failed to update stage" });
      }
    },
  );

  app.post(
    "/api/trading/progression/unlock/:stageId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const stageId = req.params.stageId as TradingStageId;
        if (!TRADING_STAGES.some((s) => s.id === stageId)) {
          return res.status(400).json({ error: "Unknown stage" });
        }
        const next = await unlockStage(req.user.claims.sub, stageId);
        res.json(next);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "Failed to unlock stage" });
      }
    },
  );

  app.post(
    "/api/trading/progression/current/:stageId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const stageId = req.params.stageId as TradingStageId;
        if (!TRADING_STAGES.some((s) => s.id === stageId)) {
          return res.status(400).json({ error: "Unknown stage" });
        }
        const next = await setCurrentStage(req.user.claims.sub, stageId);
        res.json(next);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "Failed to set current stage" });
      }
    },
  );
}
