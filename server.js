// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: (origin, callback) => callback(null, true), // allow all origins
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
// Handle preflight OPTIONS for /api/chat
app.options('/api/chat', cors());

// Admin memory folder
const memoryFolder = path.resolve('./ZedAI_data');
if (!fs.existsSync(memoryFolder)) {
  fs.mkdirSync(memoryFolder, { recursive: true });
}
const memoryFile = path.join(memoryFolder, 'memory.json');
let adminMemory = [];
if (fs.existsSync(memoryFile)) {
  try {
    adminMemory = JSON.parse(fs.readFileSync(memoryFile, 'utf-8'));
  } catch {
    adminMemory = [];
  }
}

// Helper to log messages
const logMessage = (msg) => {
  fs.appendFileSync('zed-chat.log', `[${new Date().toISOString()}] ${msg}\n`);
};

// POST /api/chat
app.post('/api/chat', (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Simulate Zed response using Admin memory
    const reply = `Zed received: ${message}. Memory count: ${adminMemory.length}`;

    // Store message in memory
    adminMemory.push({ user: 'Admin', message, reply });
    fs.writeFileSync(memoryFile, JSON.stringify(adminMemory, null, 2));

    logMessage(`User: ${message} | Zed: ${reply}`);

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Zed backend listening on port ${port}`);
});
