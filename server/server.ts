import express from "express";
import cors from "cors";
import helmet from "helmet";

const PORT = process.env.PORT || 5000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

const app = express();

// CORS middleware at the top
app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Handle all OPTIONS preflight requests globally
app.options("*", cors());

// Helmet middleware with CSP
app.use(
  helmet({
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
  })
);

// Parse JSON bodies
app.use(express.json());

// Prefix all backend routes with /api
const router = express.Router();

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

    } catch (err) {
      console.error("[ZedAI] ERROR:", err);
  res.status(500).json({ error: (err as any)?.message || "Internal server error" });
    }
  })();
});

app.use("/api", router);

// Start the server
app.listen(PORT, () => {
  console.log(`🔥 ZedAI backend live on port ${PORT}`);
});
