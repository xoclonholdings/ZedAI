import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { checkDatabaseConnection } from "./db";
import { runMigrations } from "./migrations";
import authRoutes from "./routes/auth";
import authMiddleware from "./middleware/auth";

const app = express();
app.set('trust proxy', 1); // behind Railway/edge proxy

// Security headers
app.use(helmet());
app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true, preload: false }));
// CORS
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));

app.use(express.json({ limit: '1mb' }));
// HTTPS redirect (works with Railway's X-Forwarded-Proto)
app.use((req, res, next) => {
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
  const host = req.headers.host;
  return res.redirect(301, `https://${host}${req.originalUrl}`);
});
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

  // Log all /api/ask requests
  if (path.startsWith('/api/ask')) {
    log(`[ASK] Incoming: ${req.method} ${path} - body: ${JSON.stringify(req.body)}`);
  }

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


    const PORT = Number(process.env.PORT || 5001);
    app.set('port', PORT);
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log('[zed] listening', PORT);
    });

  } catch (error) {
    log("❌ Failed to start server: " + String(error));
    process.exit(1);
  }
})();
