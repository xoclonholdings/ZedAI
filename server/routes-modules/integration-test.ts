import type { Express } from "express";

import { isAdmin } from "../localAuth";
import { DigitalExecutionService } from "../services/execution/DigitalExecutionService";
import { loadAdminSettings } from "../services/AdminSettingsStore";
import { logRuntimeEvent } from "../services/RuntimeLogger";
import { ownerUserIdFromAuthenticatedRequest } from "../services/auth/OwnerContext";

/**
 * Test endpoints that let the user verify a connection actually
 * works right after saving it in Connections.
 *
 * These bypass approvals / self-repair / trace validation on purpose —
 * their whole job is to give the user immediate feedback about
 * whether the credential they just pasted is valid.
 *
 * Non-goals: any of these becoming production dispatch paths. They
 * exist to answer the "did my paste work?" question and nothing else.
 */
export function registerIntegrationTestRoutes(app: Express): void {
  // POST /api/admin/integrations/email/test
  // Body: { to?: string, accountId?: string }
  //
  // Sends a small "ZAR test message" to the address in `to`, or —
  // if none is provided — to the currently signed-in admin's
  // account fromAddress. Returns the raw result so the UI can
  // surface exactly what went right or wrong.
  app.post("/api/admin/integrations/email/test", isAdmin, async (req: any, res) => {
    try {
      const settings = await loadAdminSettings();
      const accounts = settings.integrations.email?.accounts || [];
      if (accounts.length === 0) {
        return res.status(400).json({
          error: "No email accounts connected yet. Connect Gmail or another provider first.",
        });
      }

      const requestedAccountId = req.body?.accountId as string | undefined;
      const account =
        (requestedAccountId
          ? accounts.find((a: any) => a.id === requestedAccountId)
          : accounts[0]) || accounts[0];

      const to =
        (typeof req.body?.to === "string" && req.body.to.trim()) ||
        account.fromAddress;
      if (!to) {
        return res
          .status(400)
          .json({ error: "No destination address available for the test." });
      }

      const result = await DigitalExecutionService.execute({
        task_id: `email-test-${Date.now()}`,
        user_id: ownerUserIdFromAuthenticatedRequest(req),
        approved: true,
        execution_mode: "digital",
        action_type: "email",
        payload: {
          to,
          subject: "Test from ZAR",
          body:
            `This is a test message from ZAR. If you're reading it, your ${account.provider} account is set up correctly.\n\n` +
            `Sent from ${account.fromAddress || account.username}.`,
          from: account.fromAddress,
        },
      });

      void logRuntimeEvent({
        level: result.status === "success" ? "info" : "warn",
        source: "server",
        event: "integration.email.test",
        detail: `${account.provider} → ${to} : ${result.status}${result.failureReason ? ` (${result.failureReason})` : ""}`,
      });

      res.json({
        status: result.status,
        detail: result.result,
        failureReason: result.failureReason,
        providerUsed: result.providerUsed,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Test send failed" });
    }
  });
}
