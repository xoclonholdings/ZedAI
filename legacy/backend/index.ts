// ZedAI backend entry
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { updateState, getContext } from './adaptiveLearning.js';
import { saveTurn, getHistory } from './memory.js';
import { getAIResponse } from './aiConnection.js';

const app = express();
const PORT = process.env.PORT || 8080;
app.use(cors());
app.use(bodyParser.json());

// /learn endpoint
app.post('/learn', (req, res) => {
  try {
    const { input, response } = req.body;
    updateState(input, response);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// /memory endpoint
app.get('/memory', (req, res) => {
  try {
    const history = getHistory();
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});
app.post('/memory', (req, res) => {
  try {
    const { user, ai } = req.body;
    saveTurn(user, ai);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// /ai endpoint
app.post('/ai', async (req, res) => {
  try {
    const { input } = req.body;
    const aiResponse = await getAIResponse(input);
    saveTurn(input, aiResponse);
    updateState(input, aiResponse);
    res.json({ success: true, response: aiResponse });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`ZedAI backend running on port ${PORT}`);
});
