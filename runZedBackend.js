const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.resolve(__dirname, 'zed-backend.log');
const SERVER_PATH = path.resolve(__dirname, './server/dist/index.js');
const PORT = process.env.PORT || 3000;
let serverProcess = undefined;

function startServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = undefined;
  }
  const out = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  const err = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  serverProcess = spawn('node', [SERVER_PATH], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', out, err],
    detached: false,
  });
  if (serverProcess) {
    serverProcess.on('exit', (code, signal) => {
      fs.appendFileSync(LOG_FILE, `\n[ZedBackend] Server exited with code ${code}, signal ${signal}\n`);
      setTimeout(() => {
        fs.appendFileSync(LOG_FILE, `[ZedBackend] Attempting restart...\n`);
        startServer();
      }, 1000);
    });
    serverProcess.on('error', (err) => {
      fs.appendFileSync(LOG_FILE, `\n[ZedBackend] Server error: ${err}\n`);
      setTimeout(() => {
        fs.appendFileSync(LOG_FILE, `[ZedBackend] Attempting restart after error...\n`);
        startServer();
      }, 1000);
    });
  }
  console.log(`✅ Zed backend is running on port ${PORT}`);
}

process.on('SIGINT', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = undefined;
  }
  console.log('\n[ZedBackend] Server stopped gracefully.');
  process.exit(0);
});

startServer();
