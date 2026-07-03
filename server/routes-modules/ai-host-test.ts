import type { Express } from "express";

import { isAdmin } from "../localAuth";
import {
  checkModelProviderHealth,
  generateChatFromProvider,
} from "../services/ModelProviderService";
import {
  getActiveProviderName,
  getResolvedTargetName,
} from "../core/providers/provider-executor";
import {
  getActiveProviderDefaultModel,
  getProviderRuntimeConfig,
} from "../core/providers/provider-config";
import { logRuntimeEvent } from "../services/RuntimeLogger";

/**
 * POST /api/admin/ai-host/test
 *
 * Round-trips one short prompt through the active provider and returns
 * a structured pass/fail with the actual upstream error message — used
 * by the admin Integrations → AI Host panel to diagnose provider
 * misconfigurations (wrong URL, bad API key, billing, etc.) without
 * tailing the server log.
 */
export function registerAiHostTestRoute(app: Express): void {
  app.post("/api/admin/ai-host/test", isAdmin, async (_req, res) => {
    try {
      const health = await checkModelProviderHealth();
      const provider = getActiveProviderName({ lane: "chat" });
      const target = getResolvedTargetName({ lane: "chat" });
      const providerConfig = getProviderRuntimeConfig();
      const model =
        providerConfig.activeModel || getActiveProviderDefaultModel(providerConfig);

      let chatStatus: "ok" | "error" = "ok";
      let reply = "";
      let error = "";
      let errorKind = "";
      const startedAt = Date.now();

      try {
        reply = await generateChatFromProvider(
          [{ role: "user", content: "Reply with READY only." }],
          undefined,
          { lane: "manager" },
        );
      } catch (chatError: any) {
        chatStatus = "error";
        const message =
          (typeof chatError?.message === "string" && chatError.message) ||
          (typeof chatError === "string" && chatError) ||
          "";
        errorKind = chatError?.constructor?.name || "Error";
        error =
          message ||
          (() => {
            try {
              return JSON.stringify(chatError);
            } catch {
              return String(chatError);
            }
          })();
        await logRuntimeEvent({
          level: "error",
          source: "server",
          event: "admin.ai_host.test_failed",
          detail: error,
          context: { provider, target, model, kind: errorKind },
        });
      }

      res.json({
        provider,
        target,
        model,
        elapsedMs: Date.now() - startedAt,
        health,
        chat: { status: chatStatus, reply, error, errorKind },
      });
    } catch (error: any) {
      res.status(500).json({
        error:
          error?.message ||
          (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })(),
      });
    }
  });
}
