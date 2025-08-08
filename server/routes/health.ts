import { Router } from 'express';
import fetch from 'node-fetch';

const MODEL = process.env.MODEL || 'llama3';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

const router = Router();

router.get('/healthz', (req, res) => {
  res.json({ ok: true, ts: Date.now(), model: MODEL });
});

router.get('/readyz', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const r = await fetch(`${OLLAMA_HOST}/api/tags`, { method: 'POST', signal: controller.signal });
    clearTimeout(timeout);

    if (r.ok) return res.json({ ready: true });
    throw new Error('Ollama not ready');
  } catch {
    res.status(502).json({ ready: false });
  }
});

export default router;
