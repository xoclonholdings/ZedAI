// ZedAI Chat Backend - ES Modules, Fully Self-Contained
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const MEMORY_DIR = path.resolve(__dirname, 'ZedAI_data');
const LOG_FILE = path.resolve(__dirname, 'zed-chat.log');

// Ensure memory folder exists
if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

// Load admin memory (all files in ZedAI_data)
function loadAdminMemory() {
  let memory = '';
  try {
    const files = fs.readdirSync(MEMORY_DIR);
    for (const file of files) {
      const filePath = path.join(MEMORY_DIR, file);
      if (fs.statSync(filePath).isFile()) {
        memory += fs.readFileSync(filePath, 'utf8') + '\n';
      }
    }
  } catch (err) {
    memory = '';
  }
  return memory.trim();
}
let adminMemory = loadAdminMemory();

// Watch for changes in admin memory
fs.watch(MEMORY_DIR, { recursive: true }, () => {
  adminMemory = loadAdminMemory();
});

const app = express();

// Dynamic CORS for all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

// POST /api/chat route
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Invalid message.' });
    }
    // Simulate ZedAI response using admin memory
    const reply = `ZedAI (with Admin Memory): ${message}\n\n[Admin Memory]\n${adminMemory}`;
    // Log message and reply
    const logEntry = `[${new Date().toISOString()}] Message: ${message}\nReply: ${reply}\n---\n`;
    fs.appendFile(LOG_FILE, logEntry, () => {});
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message || 'Unknown error.' });
});

app.listen(PORT, () => {
  console.log(`✅ ZedAI backend running on port ${PORT}`);
});

// Keep process alive indefinitely
process.stdin.resume();
