"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const PORT = process.env.PORT || 5000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const app = (0, express_1.default)();
// CORS middleware at the top
app.use((0, cors_1.default)({
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));
// Handle all OPTIONS preflight requests globally
app.options("*", (0, cors_1.default)());
// Helmet middleware with CSP
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: [
                "'self'",
                "http://localhost:5000",
                "http://localhost",
                "http://yourdomain.com",
            ],
        },
    },
}));
// Parse JSON bodies
app.use(express_1.default.json());
// Prefix all backend routes with /api
const router = express_1.default.Router();
router.post("/chat", (req, res) => {
    (async () => {
        try {
            const message = req.body.message;
            if (!message) {
                res.status(400).json({ error: "Missing 'message' field in request body." });
                return;
            }
            // Log incoming message
            console.log("[ZedAI] Incoming message:", message);
            // Import Zed AI engine and admin memory
            const { getAIResponse } = await import("./aiConnection.js");
            const { getContext } = await import("./adaptiveLearning.js");
            const { getHistory, saveTurn } = await import("./memory.js");
            // Compose context for admin memory
            const adminContext = getContext();
            const history = getHistory();
            // Pass message and admin context to AI engine
            const reply = await getAIResponse(`${adminContext}\n${message}`);
            // Save turn to memory
            saveTurn(message, reply);
            // Log outgoing reply
            console.log("[ZedAI] AI reply:", reply);
            res.json({ reply });
        }
        catch (err) {
            console.error("[ZedAI] Error in /api/chat:", err);
            res.status(500).json({ error: err?.message || "Internal server error" });
        }
    })();
});
app.use("/api", router);
// Start the server
app.listen(PORT, () => {
    console.log(`🔥 ZedAI backend live on port ${PORT}`);
});
