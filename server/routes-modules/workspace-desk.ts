import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { WORKSPACE_DESK_SPECS } from "../../shared/workspace-desk-types";
import {
  deleteDeskEntry,
  generateDeskEntry,
  listDeskEntries,
} from "../services/workspace-desk/WorkspaceDeskEngine";
import { ownerUserIdFromAuthenticatedRequest } from "../services/auth/OwnerContext";

/**
 * Workspace desk routes — the working surface for Education, Operations,
 * and Marketing. Each entry is memory-grounded and saved durably.
 */

export function registerWorkspaceDeskRoutes(app: Express): void {
  app.get("/api/workspaces/:workspace/desk", isAuthenticated, async (req: any, res) => {
    const workspace = String(req.params.workspace);
    if (!WORKSPACE_DESK_SPECS[workspace]) {
      return res.status(404).json({ error: "No desk for this workspace" });
    }
    try {
      const entries = await listDeskEntries(workspace, ownerUserIdFromAuthenticatedRequest(req));
      res.json({ spec: WORKSPACE_DESK_SPECS[workspace], entries });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load desk" });
    }
  });

  app.post("/api/workspaces/:workspace/desk", isAuthenticated, async (req: any, res) => {
    const workspace = String(req.params.workspace);
    if (!WORKSPACE_DESK_SPECS[workspace]) {
      return res.status(404).json({ error: "No desk for this workspace" });
    }
    const topic = String(req.body?.topic || "").trim();
    if (!topic) return res.status(400).json({ error: "topic is required" });
    try {
      const entry = await generateDeskEntry({
        workspace,
        userId: ownerUserIdFromAuthenticatedRequest(req),
        isAdmin: Boolean(req.user?.claims?.isAdmin),
        topic,
        sources: req.body?.sources ? String(req.body.sources) : undefined,
      });
      res.json({ entry });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "ZAR could not build this right now." });
    }
  });

  app.delete("/api/workspaces/:workspace/desk/:id", isAuthenticated, async (req: any, res) => {
    const workspace = String(req.params.workspace);
    if (!WORKSPACE_DESK_SPECS[workspace]) {
      return res.status(404).json({ error: "No desk for this workspace" });
    }
    try {
      const entries = await deleteDeskEntry(
        workspace,
        ownerUserIdFromAuthenticatedRequest(req),
        String(req.params.id),
      );
      res.json({ entries });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete" });
    }
  });
}
