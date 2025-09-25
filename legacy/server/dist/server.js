"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const net_1 = __importDefault(require("net"));
// Function to find an available port
async function findAvailablePort(startPort) {
    return new Promise((resolve) => {
        const server = net_1.default.createServer();
        server.listen(startPort, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            findAvailablePort(startPort + 1).then(resolve);
        });
    });
}
const DEFAULT_PORT = 5000;
const FRONTEND_DIR = path_1.default.join(__dirname, "../client/dist");
// Will be set after finding an available port
let PORT;
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Dynamic CORS configuration
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        // List of allowed origins
        const allowedOrigins = [
            process.env.ALLOWED_ORIGIN,
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5173'
        ].filter(Boolean); // Remove undefined/null values
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
// Helmet middleware with CSP
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : "",
                "https://zed-ai.online",
                "https://api.zed-ai.online",
            ].filter(Boolean),
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
                "'self'",
                "https://zed-ai.online",
                "https://api.zed-ai.online",
                process.env.NODE_ENV === 'development' ? "http://localhost:*" : "",
                process.env.NODE_ENV === 'development' ? "ws://localhost:*" : "",
                process.env.NODE_ENV === 'development' ? "http://127.0.0.1:*" : "",
                process.env.NODE_ENV === 'development' ? "ws://127.0.0.1:*" : "",
            ].filter(Boolean),
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"]
        },
    },
}));
// Parse JSON bodies
app.use(express_1.default.json());
// Prefix all backend routes with /api
const router = express_1.default.Router();
// Health check endpoint
router.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
router.post("/chat", (req, res) => {
    (async () => {
        try {
            const message = req.body.message;
            console.log("[ZedAI] Incoming message:", message);
            const { getAIResponse } = await import("./aiConnection.js");
            console.log("[ZedAI] aiConnection.js loaded");
            const { getContext } = await import("./adaptiveLearning.js");
            console.log("[ZedAI] adaptiveLearning.js loaded");
            const { getHistory, saveTurn } = await import("./memory.js");
            console.log("[ZedAI] memory.js loaded");
            const context = getContext();
            const history = getHistory();
            console.log("[ZedAI] Context + history pulled");
            const reply = await getAIResponse(`${context}\n${message}`);
            console.log("[ZedAI] AI reply generated:", reply);
            saveTurn(message, reply);
            console.log("[ZedAI] Reply saved to memory");
            res.json({ reply });
        }
        catch (err) {
            console.error("[ZedAI] ERROR:", err);
            res.status(500).json({ error: err?.message || "Internal server error" });
        }
    })();
});
app.use("/api", router);
// Serve static files only in production
if (process.env.NODE_ENV === 'production') {
    app.use(express_1.default.static(FRONTEND_DIR));
    // Always serve index.html for any unmatched routes (for client-side routing)
    app.get("*", (req, res) => {
        res.sendFile(path_1.default.join(FRONTEND_DIR, "index.html"));
    });
}
else {
    // Development mode: provide simple health check at root
    app.get("/", (req, res) => {
        res.json({
            status: "ZedAI Backend Development Server",
            mode: "development",
            port: PORT || "detecting...",
            endpoints: {
                health: "/api/health",
                chat: "/api/chat"
            },
            frontend: "http://localhost:3000"
        });
    });
}
// Start the server
// Initialize server with dynamic port
async function startServer() {
    try {
        PORT = await findAvailablePort(DEFAULT_PORT);
        server.listen(PORT, () => {
            console.log(`🔥 ZedAI backend live on port ${PORT}`);
            console.log(`📁 Serving frontend from ${FRONTEND_DIR}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
