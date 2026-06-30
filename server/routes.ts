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
import { registerOrchestrateAndMiscRoutes } from "./routes-modules/orchestrate-and-misc";
import { registerConversationCrudRoutes } from "./routes-modules/conversations-crud";
import { registerConversationSendRoutes } from "./routes-modules/conversations-send";

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

  // Session-scoped current-user surfaces (identity, personalization,
  // avatar upload) — routes-modules/me.ts
  registerMeRoutes(app);

  // Conversation CRUD + per-conversation files/upload + messages GET —
  // routes-modules/conversations-crud.ts
  registerConversationCrudRoutes(app);

  // POST /api/conversations/:id/messages — the big SSE handler. Carries
  // the tier check, web-lookup short-circuit (ManagerAgent →
  // IntelligenceAgent), memory + admin context injection, and the
  // Ollama streaming pipeline. Lives in its own module because it pulls
  // in the entire chat stack.
  registerConversationSendRoutes(app);

  // Knowledge / memory endpoints — routes-modules/knowledge.ts
  registerKnowledgeRoutes(app);

  // Structured knowledge ingestion + contextual inquiry endpoints —
  // routes-modules/knowledge-ingestion.ts. This is service-owned and
  // produces candidate graph knowledge, not vector chunks.
  registerKnowledgeIngestionRoutes(app);

  // ── Projects (CRUD + instructions + sources + conversation assignment) ─
  // Extracted to routes-modules/projects.ts.
  registerProjectRoutes(app);

  // Orchestrator + voice stub + admin knowledge overview — packed
  // together in routes-modules/orchestrate-and-misc.ts because each
  // handler is small and they share dependencies (KnowledgeService,
  // ManagerAgent, AdminSettingsStore).
  registerOrchestrateAndMiscRoutes(app, {
    isDatabaseHealthy: () => isDatabaseHealthy,
  });

  // AI host connectivity test — extracted to routes-modules/ai-host-test.ts
  registerAiHostTestRoute(app);

  // Admin settings (app prefs, personalization, integrations, managed
  // users, integration status probes) — routes-modules/admin-settings.ts
  registerAdminSettingsRoutes(app);

  // Ruleset YAML CRUD (raw + structured) — extracted to routes-modules/ruleset.ts.
  // ManagerAgent cache flush happens inside the module on every write.
  registerRulesetRoutes(app);

  // ── Diagnostics (admin status snapshot + provider routing + runtime) ─
  // Extracted to routes-modules/diagnostics.ts. Database health is
  // mutated by the boot pipeline, so we pass a getter callback.
  registerDiagnosticsRoutes(app, { isDatabaseHealthy: () => isDatabaseHealthy });

  // ── Flows (admin CRUD + user-facing + run lifecycle) ──────────────
  // Route-order requirement (/api/flows/runs before /api/flows/:id) is
  // preserved inside the module.
  registerFlowRoutes(app);

  // ── Trading Intelligence Phase 1 (education, analysis, simulation) ─
  // ZCOS-owned trading services. No broker connections or live orders.
  registerTradingRoutes(app);

  // Env validator — pure logic in services/EnvValidator.ts, thin route
  // wrapper in routes-modules/env-validate.ts.
  registerEnvValidateRoute(app);

  // Admin logs + client-log ingest + security log — routes-modules/admin-logs.ts
  registerAdminLogsRoutes(app);

  // Approvals (queue + approve/:id + reject/:id, with the legacy entry
  // shape + working-memory + conversation-confirmation helpers) —
  // routes-modules/approvals.ts
  registerApprovalRoutes(app);

  registerExecutionRoutes(app);
  registerIntakeRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
