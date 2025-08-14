// zed-chat-autofix.cjs
const { exec, spawn } = require('child_process');
const axios = require('axios');

const CHAT_PORT = 5001;
const HEALTH_URL = `http://localhost:${CHAT_PORT}/health`;
const CHAT_URL = `http://localhost:${CHAT_PORT}/chat`;
const MAX_HEALTH_RETRIES = 5;

function isPortOpen(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = net.createConnection(port, '127.0.0.1');
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

function startBackend() {
  // Try npm run dev, fallback to node server.js
  let proc = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), stdio: 'inherit', shell: true });
  proc.on('error', () => {
    proc = spawn('node', ['server.js'], { cwd: process.cwd(), stdio: 'inherit', shell: true });
  });
  return proc;
}

async function waitForHealth(retries = MAX_HEALTH_RETRIES) {
  let delay = 1000;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(HEALTH_URL, { timeout: 2000 });
      if (res.status === 200) {
        console.log('Health check success:', res.data);
        return true;
      }
    } catch (err) {
      console.log(`Health check failed (attempt ${i + 1}):`, err.message);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  return false;
}

async function testChat() {
  try {
    const res = await axios.post(CHAT_URL, { message: 'Test message from audit script' }, { timeout: 3000 });
    console.log('Chat API response:', res.data);
    return 'CONNECTED';
  } catch (err) {
    console.log('Chat API error:', err.message);
    return 'FAILED';
  }
}

(async () => {
  let backendRunning = await isPortOpen(CHAT_PORT);
  if (!backendRunning) {
    console.log('Backend not running. Starting...');
    startBackend();
    // Wait for backend to start
    let healthOk = await waitForHealth();
    if (!healthOk) {
      console.log('Backend health check failed after retries.');
      process.exit(1);
    }
  } else {
    console.log('Backend already running.');
  }

  // Network test
  const status = await testChat();
  console.log('Status summary:', status);
})();
