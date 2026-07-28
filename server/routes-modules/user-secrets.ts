import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { UserSecretsStore } from "../services/UserSecretsStore";

function userIdFrom(req: any): string {
  return req.user?.claims?.sub || "unknown";
}

/**
 * The user's own secrets vault - see UserSecretsStore. Available to any
 * authenticated user regardless of admin status, unlike the shared
 * admin-wide integrations settings.
 */
export function registerUserSecretsRoutes(app: Express): void {
  app.get("/api/me/secrets", isAuthenticated, async (req: any, res) => {
    try {
      res.json({ secrets: await UserSecretsStore.list(userIdFrom(req)) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load secrets" });
    }
  });

  app.post("/api/me/secrets", isAuthenticated, async (req: any, res) => {
    const label = String(req.body?.label || "").trim();
    const value = String(req.body?.value || "").trim();
    if (!label || !value) return res.status(400).json({ error: "label and value are required" });
    try {
      const secret = await UserSecretsStore.create(userIdFrom(req), label, value);
      res.json({ secret });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to save secret" });
    }
  });

  app.delete("/api/me/secrets/:id", isAuthenticated, async (req: any, res) => {
    try {
      await UserSecretsStore.remove(userIdFrom(req), String(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete secret" });
    }
  });
}
