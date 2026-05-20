import type { Express } from "express";

import { registerApprovalEndpoints } from "./execution-routes/approval";
import { registerExecutionEndpoints } from "./execution-routes/execution";
import { registerHumanBridgeEndpoints } from "./execution-routes/human-bridge";
import { registerOperationalEndpoints } from "./execution-routes/operational";
import { registerWorkflowEndpoints } from "./execution-routes/workflow";

/**
 * registerExecutionRoutes
 *
 * Adds the additive HTTP surface for the new execution + approval +
 * workflow + operational layers. No existing routes are touched.
 *
 * Endpoints are namespaced under /api/execution, /api/approval,
 * /api/workflow, and /api/operational so they cannot collide with
 * the existing surface. Each namespace lives in its own file under
 * ./execution-routes/ so route ownership is obvious at a glance.
 *
 * Mobile-first: every payload is JSON only — no UI changes required.
 */
export function registerExecutionRoutes(app: Express): void {
  registerExecutionEndpoints(app);
  registerHumanBridgeEndpoints(app);
  registerApprovalEndpoints(app);
  registerWorkflowEndpoints(app);
  registerOperationalEndpoints(app);
}

export default registerExecutionRoutes;
