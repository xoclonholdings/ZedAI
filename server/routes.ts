import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupLocalAuth } from "./localAuth";
import { logRuntimeEvent } from "./services/RuntimeLogger";
import { registerFlowRoutes } from "./routes-modules/flows";
import { registerTradingRoutes } from "./routes-modules/trading";
import { registerEnvValidateRoute } from "./routes-modules/env-validate";
import { registerExecutionRoutes } from "./services/execution/registerExecutionRoutes";
import { registerIntakeRoutes } from "./services/intake/registerIntakeRoutes";
import { registerProjectRoutes } from "./routes-modules/projects";
import { registerDiagnosticsRoutes } from "./routes-modules/diagnostics";
import { registerAiHostTestRoute } from "./routes-modules/ai-host-test";
import { registerRulesetRoutes } from "./routes-modules/ruleset";
import { registerAdminSettingsRoutes } from "./routes-modules/admin-settings";
import { registerAdminLogsRoutes } from "./routes-modules/admin-logs";
import { registerApprovalRoutes } from "./routes-modules/approvals";
import { registerMeRoutes } from "./routes-modules/me";
import { registerKnowledgeRoutes } from "./routes-modules/knowledge";
import { registerKnowledgeIngestionRoutes } from "./routes-modules/knowledge-ingestion";
import { registerEmailInboxRoutes } from "./routes-modules/email-inbox";
import { registerOrchestrateAndMiscRoutes } from "./routes-modules/orchestrate-and-misc";
import { registerConversationCrudRoutes } from "./routes-modules/conversations-crud";
import { registerConversationSendRoutes } from "./routes-modules/conversations-send-clean";

let isDatabaseHealthy = false;

export function setDatabaseStatus(status: boolean) {
  isDatabaseHealthy = status;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupLocalAuth(app);

  app.use(async (req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      const status = res.statusCode;
      if (status >= 400) {
        void logRuntimeEvent({
          level: status >= 500 ? "error" : "warn",
          source: "server",
          event: "http.response",
          detail: `${req.method} ${req.originalUrl} -> ${status}`,
          context: {
            method: req.method,
            url: req.originalUrl,
            status,
            durationMs: Date.now() - startedAt,
          },
        });
      }
    });
    next();
  });

  registerMeRoutes(app);
  registerConversationCrudRoutes(app);
  registerConversationSendRoutes(app);
  registerKnowledgeRoutes(app);
  registerKnowledgeIngestionRoutes(app);
  registerEmailInboxRoutes(app);
  registerProjectRoutes(app);
  registerOrchestrateAndMiscRoutes(app, {
    isDatabaseHealthy: () => isDatabaseHealthy,
  });
  registerAiHostTestRoute(app);
  registerAdminSettingsRoutes(app);
  registerRulesetRoutes(app);
  registerDiagnosticsRoutes(app, { isDatabaseHealthy: () => isDatabaseHealthy });
  registerFlowRoutes(app);
  registerTradingRoutes(app);
  registerEnvValidateRoute(app);
  registerAdminLogsRoutes(app);
  registerApprovalRoutes(app);
  registerExecutionRoutes(app);
  registerIntakeRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
