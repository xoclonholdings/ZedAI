import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import {
  acceptFlowSuggestion,
  computeFlowSuggestions,
  dismissFlowSuggestion,
} from "../services/FlowSuggestionEngine";
import type { FlowCategory } from "../../shared/flow-types";

function userIdFrom(req: any): string {
  return req.user?.claims?.sub || "unknown";
}

/**
 * ZAR noticing a pattern in what you keep asking for, and offering to save
 * it as a real Flow (a "shortcut") in Tools. See FlowSuggestionEngine for
 * how patterns are detected.
 */
export function registerFlowSuggestionRoutes(app: Express): void {
  app.get("/api/flows/suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const suggestions = await computeFlowSuggestions(userIdFrom(req));
      res.json({ suggestions });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to compute suggestions" });
    }
  });

  app.post("/api/flows/suggestions/:id/accept", isAuthenticated, async (req: any, res) => {
    try {
      const flow = await acceptFlowSuggestion(userIdFrom(req), String(req.params.id), {
        name: req.body?.name ? String(req.body.name) : undefined,
        category: req.body?.category ? (String(req.body.category) as FlowCategory) : undefined,
        blurb: req.body?.blurb ? String(req.body.blurb) : undefined,
      });
      res.json({ flow });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to add that shortcut" });
    }
  });

  app.post("/api/flows/suggestions/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      await dismissFlowSuggestion(userIdFrom(req), String(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to dismiss" });
    }
  });
}
