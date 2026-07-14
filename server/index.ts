import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { checkDatabaseConnection, gracefulShutdown } from "./db";
import { runMigrations } from "./migrations";
import { fallbackStorage } from "./services/fallbackStorage";
import { UPLOADS_DIR, ensureRuntimeDataReady } from "./utils/repoPaths";

const app = express();

process.env.NODE_ENV = process.env.NODE_ENV || "development";
const frontendOrigin = process.env.FRONTEND_URL?.trim();

app.set("trust proxy", 1);

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;

  if (frontendOrigin && requestOrigin === frontendOrigin) {
    res.header("Access-Control-Allow-Origin", frontendOrigin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "zed-server" });
});

app.get("/", (req, res, next) => {
  const accepts = String(req.headers.accept || "");
  if (accepts.includes("text/html")) {
    return next();
  }
  res.status(200).json({ ok: true, service: "zed-server" });
});

app.head("/", (_req, res) => {
  res.sendStatus(200);
});

process.on("unhandledRejection", (reason) => {
  if (reason && typeof reason === "object" && "message" in reason) {
    const message = String((reason as { message: string }).message);
    if (
      message.includes("Connection terminated unexpectedly") ||
      message.includes("endpoint has been disabled") ||
      message.includes("Unhandled error")
    ) {
      console.log(
        "[DATABASE] Handled unhandled rejection from database connection:",
        message,
      );
      return;
    }
  }
  console.error("[SYSTEM] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error: Error) => {
  if (
    error.message.includes("Connection terminated unexpectedly") ||
    error.message.includes("endpoint has been disabled") ||
    error.message.includes("Unhandled error")
  ) {
    console.log(
      "[DATABASE] Handled uncaught exception from database connection:",
      error.message,
    );
    return;
  }
  console.error("[SYSTEM] Uncaught exception:", error);
  process.exit(1);
});

app.use("/uploads", express.static(UPLOADS_DIR));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  } as typeof res.json;

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = `${logLine.slice(0, 79)}…`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await ensureRuntimeDataReady();
  log(`Runtime data root ready at ${UPLOADS_DIR.replace(/\\uploads$/, "")}`);

  log("Initializing fallback storage system...");
  try {
    await fallbackStorage.initialize();
    log("Fallback storage initialized successfully");
  } catch (error) {
    log("[ERROR] Failed to initialize fallback storage:", String(error));
  }

  // Start serving as EARLY as possible. Login, sessions, and /api/me
  // depend only on local file state (file-backed session store + admin
  // settings) — never the database. So we bind the HTTP server before
  // the slow warmup (DB connect, migrations, core memory, curation). On
  // a cold instance this is the difference between login responding in
  // milliseconds and it hanging for minutes behind a cold database +
  // migrations. Until the warmup flips the DB on, DB-backed requests
  // transparently use fallback storage — the existing offline mode.
  const { setDatabaseStatus } = await import("./routes");
  setDatabaseStatus(false);

  // Lightweight, unauthenticated liveness ping. Point an uptime monitor
  // (e.g. every few minutes) at this to keep the instance warm and avoid
  // idle-spindown cold starts. Always fast — never touches the DB or the
  // model provider.
  const bootedAt = Date.now();
  app.get(["/api/health", "/healthz"], (_req, res) => {
    res.status(200).json({ status: "ok", uptimeSeconds: Math.round((Date.now() - bootedAt) / 1000) });
  });

  const server = await registerRoutes(app);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);

  server.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      log("ZED AI accepting requests; warming up database + memory in the background");
    },
  );

  // Background warmup — never blocks request serving. Runs after the
  // server is already listening so a cold start doesn't delay login.
  void (async () => {
    log("Checking database connection...");
    let dbHealthy = false;
    try {
      dbHealthy = await checkDatabaseConnection();
      if (dbHealthy) {
        log("Database connection established successfully");
        try {
          await runMigrations();
          log("Database migrations completed");
        } catch (migrationError) {
          log("[WARNING] Migration failed, continuing in offline mode");
          dbHealthy = false;
        }
      }
    } catch (error) {
      log("[WARNING] Database connection failed - offline mode");
      dbHealthy = false;
    }
    setDatabaseStatus(dbHealthy);
    log(
      dbHealthy
        ? "[INFO] Online with database + fallback storage redundancy"
        : "[INFO] Offline mode with fallback storage - full functionality maintained",
    );

    // Restore admin settings (managed users + credentials) from the
    // durable database into the local file cache, so an ephemeral
    // redeploy doesn't erase users added via Settings. No-op offline.
    if (dbHealthy) {
      try {
        const { hydrateAdminSettingsFromDb } = await import("./services/admin-settings/io");
        await hydrateAdminSettingsFromDb();
      } catch (error) {
        log("[WARNING] admin-settings DB hydrate failed:", String((error as Error)?.message || error));
      }
    }

    try {
      const { MemoryService } = await import("./services/memoryService");
      await MemoryService.loadCoreMemoryFromFile();
      log("Core memory loaded from core.memory.json successfully");
    } catch (error) {
      log("[WARNING] Failed to initialize core memory - using default memory");
    }

    try {
      const { startKnowledgeCurationScheduler } = await import(
        "./services/KnowledgeCurationEngine"
      );
      startKnowledgeCurationScheduler();
      log("Knowledge curation scheduler active");
    } catch (error) {
      log("[WARNING] Failed to start knowledge curation scheduler:", String(error));
    }

    try {
      const { startTradeResolverScheduler } = await import(
        "./zcos/trading/TradeResolverScheduler"
      );
      startTradeResolverScheduler((msg) => log(msg));
    } catch (error) {
      log("[WARNING] Failed to start trade resolver scheduler:", String(error));
    }

    // Lightning connectivity smoke check. Surfaces a misconfigured
    // provider (missing LIGHTNING_BASE_URL / LIGHTNING_API_KEY, wrong
    // endpoint, 401) as one clear line in the deploy log instead of a
    // 401 on the user's phone.
    try {
      const { getProviderRuntimeConfig } = await import("./core/providers/provider-config");
      const { checkModelProviderHealth } = await import("./services/ModelProviderService");
      const cfg = getProviderRuntimeConfig();
      if (!cfg.lightning.baseUrl) {
        log("[LIGHTNING] OFFLINE — LIGHTNING_BASE_URL is not set; model calls will fail.");
      } else {
        if (!cfg.lightning.apiKey) {
          log(
            "[LIGHTNING] MISCONFIGURED — LIGHTNING_API_KEY is not set; requests will 401 'Missing or invalid Authorization header'.",
          );
        }
        const health = await checkModelProviderHealth();
        if (health.status === "online") {
          log(`[LIGHTNING] online — ${health.target} (models: ${health.models.join(", ") || "n/a"})`);
        } else {
          log(`[LIGHTNING] OFFLINE — ${health.target || "no endpoint"} did not respond healthy.`);
        }
      }
    } catch (error) {
      log("[LIGHTNING] smoke check failed:", String((error as Error)?.message || error));
    }
  })();

  const shutdown = async (signal: string) => {
    log(`Received ${signal}, shutting down gracefully...`);
    try {
      const { stopKnowledgeCurationScheduler } = await import(
        "./services/KnowledgeCurationEngine"
      );
      stopKnowledgeCurationScheduler();
      await gracefulShutdown();
      log("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      log("Error during shutdown:", String(error));
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
})();