import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import corsMiddleware from "./middleware/cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { checkDatabaseConnection } from "./db";
import { runMigrations } from "./migrations";
import authRoutes from "./routes/auth";
import authMiddleware from "./middleware/auth";

const app = express();

// CORS FIRST!
app.use(corsMiddleware);

app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: "your_secret",
  resave: false,
  saveUninitialized: false,
  name: "zed_session", // Explicitly set session name
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // true in production
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Request timing + response capture
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    log(`[${req.method}] ${path} - ${res.statusCode} (${duration}ms)`);
    if (capturedJsonResponse) {
      log(`Response: ${JSON.stringify(capturedJsonResponse)}`);
    }
  });

  next();
});

// Error handler middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  log("Global error handler:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Use authentication routes and middleware
// app.use(authRoutes); // Disabled - using localAuth instead

// Example protected route
app.post("/api/conversations/:id/messages", authMiddleware, (req, res) => {
  // If authMiddleware passes, user is authenticated
  res.json({ message: "Message received." });
});

(async () => {
  try {
    // Try database connection, but don't fail if it's not available
    try {
      await checkDatabaseConnection();
      await runMigrations();
      log("✅ Database connected and migrations completed");
    } catch (dbError) {
      log("⚠️ Database connection failed - running in offline mode:", String(dbError));
      // Continue server startup without database
    }

    // Register all API routes FIRST before Vite setup
    const httpServer = await registerRoutes(app);

    // Setup Vite/static serving AFTER API routes
    if (process.env.NODE_ENV === "development") {
      await setupVite(app);
    } else {
      serveStatic(app);
    }

    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5001;

    app.set('port', PORT);
    httpServer.listen(PORT, () => {
      log(`🚀 Server listening on http://localhost:${PORT}`);
    });

  } catch (error) {
    log("❌ Failed to start server: " + String(error));
    process.exit(1);
  }
})();
