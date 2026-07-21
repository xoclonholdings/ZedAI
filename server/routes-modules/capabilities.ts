import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { CapabilityRegistry } from "../services/capabilities/CapabilityRegistry";

/** Capability discovery for NEXUS and diagnostics — one registry, no duplicated tool descriptions. */
export function registerCapabilityRoutes(app: Express): void {
  app.get("/api/capabilities", isAuthenticated, (_req, res) => {
    res.json({ capabilities: CapabilityRegistry.list() });
  });

  app.get("/api/capabilities/health", isAuthenticated, async (_req, res) => {
    res.json({ health: await CapabilityRegistry.health() });
  });
}
