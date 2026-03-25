import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 5000;

// Bulletproof CORS setup
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
}));

// Preflight fix (crucial for sleeping containers)
app.options('*', cors());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Parse JSON bodies
app.use(bodyParser.json());

// Example Chat Route
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        console.log(`[ZedAI] Incoming message: ${message}`);
        const { getAIResponse } = await import("./aiConnection.js");
        const reply = await getAIResponse(message);
        console.log("[ZedAI] AI reply:", reply);
        res.json({ reply });
    } catch (err) {
        console.error("[ZedAI] Error in /api/chat:", err);
        res.status(500).json({ error: err?.message || "Internal server error" });
    }
});
// Start the server
app.listen(PORT, () => {
    console.log(`🔥 ZedAI backend live on port ${PORT}`);
});
