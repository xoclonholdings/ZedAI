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
    } catch (err: any) {
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
