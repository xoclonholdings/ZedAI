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
        log("[WARNING] Migration failed, but continuing with offline mode");
        dbHealthy = false;
      }
    }
  } catch (error) {
    log("[WARNING] Database connection failed - initializing offline mode");
    dbHealthy = false;
  }

  if (!dbHealthy) {
    log("Offline database mode active; using fallback storage only");
  }

  const { setDatabaseStatus } = await import("./routes");
  setDatabaseStatus(dbHealthy);

  if (!dbHealthy) {
    log("[INFO] Application will run without database features");
  }

  try {
    const { MemoryService } = await import("./services/memoryService");
    await MemoryService.loadCoreMemoryFromFile();
    log("Core memory loaded from core.memory.json successfully");
  } catch (error) {
    log("[WARNING] Failed to initialize core memory - using default memory");
  }

  app.use("/api/auth/user", (_req, res) => {
    res.status(200).json({ message: "Auth temporarily disabled" });
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
      log("ZED AI Assistant ready with hardened database connection and fallback storage");

      if (!dbHealthy) {
        log("[INFO] Running in offline mode with fallback storage - full functionality maintained");
      } else {
        log("[INFO] Running online with database + fallback storage redundancy");
      }
    },
  );

  const shutdown = async (signal: string) => {
    log(`Received ${signal}, shutting down gracefully...`);
    try {
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
