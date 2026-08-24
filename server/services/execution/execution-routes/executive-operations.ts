import type { Express, Response } from "express";

import { isAuthenticated } from "../../../localAuth";
import { ExecutiveOperationsService } from "../../executive-operations/ExecutiveOperationsService";
import type {
  ExecutiveOperationRequest,
  ExecuteExecutiveOperationRequest,
} from "../../executive-operations/types";
import { OwnerContextError } from "../../auth/OwnerContext";
import { ownerContextFrom } from "./shared";

const executiveOperations = new ExecutiveOperationsService();

/**
 * Governed cross-galaxy executive-operation entry points. These routes do
 * not create a separate assistant identity and do not bypass existing ZAR
 * authentication. Preparation is side-effect free; execution requires the
 * exact action fingerprint and a registered governed provider adapter.
 */
export function registerExecutiveOperationsEndpoints(app: Express): void {
  app.post(
    "/api/execution/executive-operations/prepare",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const operation = await executiveOperations.prepare(
          ownerContextFrom(req),
          (req.body || {}) as ExecutiveOperationRequest,
        );
        res.status(operation.state === "blocked" ? 409 : 200).json({ operation });
      } catch (error) {
        const status = error instanceof OwnerContextError ? error.statusCode : 400;
        res.status(status).json({
          error:
            error instanceof Error
              ? error.message
              : "Executive operation preparation failed.",
        });
      }
    },
  );

  app.post(
    "/api/execution/executive-operations/execute",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const operation = await executiveOperations.execute(
          ownerContextFrom(req),
          (req.body || {}) as ExecuteExecutiveOperationRequest,
        );
        const status = operation.state === "blocked" ? 409 : operation.state === "failed" ? 502 : 200;
        res.status(status).json({ operation });
      } catch (error) {
        const status = error instanceof OwnerContextError ? error.statusCode : 400;
        res.status(status).json({
          error:
            error instanceof Error
              ? error.message
              : "Executive operation execution failed.",
        });
      }
    },
  );
}

export default registerExecutiveOperationsEndpoints;
