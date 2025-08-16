// Minimal ZedAI backend server
// Provides /learn, /memory, /ai endpoints
// Integrates adaptive learning, persistent memory, and AI connection

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { updateState, getContext } from './adaptiveLearning';
import { saveTurn, getHistory } from './memory';
import { getAIResponse } from './aiConnection';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

// /learn endpoint: adaptive learning from user input
app.post('/learn', (req, res) => {
  try {
    const { input, response } = req.body;
    updateState(input, response);
    res.json({ success: true });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// /memory endpoint: persistent memory for conversation recall
app.get('/memory', (req, res) => {
  try {
    const history = getHistory();
    res.json({ success: true, history });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errorMsg });
  }
});
app.post('/memory', (req, res) => {
  try {
    const { user, ai } = req.body;
    saveTurn(user, ai);
    res.json({ success: true });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// /ai endpoint: get AI response, update memory and adaptive learning
app.post('/ai', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { input } = req.body;
    const history = getHistory();
    const context = getContext();
    const aiResponse = await getAIResponse(input);
    saveTurn(input, aiResponse);
    updateState(input, aiResponse);
    res.json({ success: true, response: aiResponse });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

app.listen(PORT, () => {
  console.log(`ZedAI backend running on port ${PORT}`);
});

// Comments: This server is minimal, production-ready, and Railway deployable.
// All endpoints are integrated with core modules. CSP and security headers should be set via Caddyfile.
