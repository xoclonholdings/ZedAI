// Secure Content-Security-Policy middleware
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self';" +
    "script-src 'self' https://zedai-production.up.railway.app;" +
    "style-src 'self' 'unsafe-inline';" +
    "connect-src 'self' https://zedai-production.up.railway.app wss://zedai-production.up.railway.app;" +
    "img-src 'self' data:;" +
    "font-src 'self';" +
    "object-src 'none';" +
    "frame-src 'none';"
  );
  next();
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: [
    'https://zed-ai-online.netlify.app'
  ],
  credentials: true
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Zed backend listening on port ${PORT}`);
});
