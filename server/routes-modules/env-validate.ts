import type { Express } from "express";

import { isAdmin } from "../localAuth";
import { validateEnv } from "../services/EnvValidator";

/** Thin route wrapper around the pure validateEnv() service. */
export function registerEnvValidateRoute(app: Express): void {
  app.get("/api/admin/env-validate", isAdmin, async (_req, res) => {
    res.json(validateEnv());
  });
}
