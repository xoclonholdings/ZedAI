const { spawn } = require('child_process');
const fsZed = require('fs');
const pathZed = require('path');

const LOG_FILE = pathZed.resolve(__dirname, 'zed-backend.log');
const SERVER_PATH = pathZed.resolve(__dirname, './server/dist/index.js');
const PORT = process.env.PORT || 3000;
/** @type {import('child_process').ChildProcess | null} */
let serverProcess: import('child_process').ChildProcess | null = null;

function startServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  const out = fsZed.createWriteStream(LOG_FILE, { flags: 'a' });
  const err = fsZed.createWriteStream(LOG_FILE, { flags: 'a' });
  serverProcess = spawn('node', [SERVER_PATH], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', out, err],
    detached: false,
  });
  if (serverProcess) {
    (serverProcess as import('child_process').ChildProcess).on('exit', (code, signal) => {
      fsZed.appendFileSync(LOG_FILE, `\n[ZedBackend] Server exited with code ${code}, signal ${signal}\n`);
      setTimeout(() => {
        fsZed.appendFileSync(LOG_FILE, `[ZedBackend] Attempting restart...\n`);
        startServer();
      }, 1000);
    });
    (serverProcess as import('child_process').ChildProcess).on('error', (err) => {
      fsZed.appendFileSync(LOG_FILE, `\n[ZedBackend] Server error: ${err}\n`);
      setTimeout(() => {
        fsZed.appendFileSync(LOG_FILE, `[ZedBackend] Attempting restart after error...\n`);
        startServer();
      }, 1000);
    });
  }
  console.log(`✅ Zed backend is running on port ${PORT}`);
}

process.on('SIGINT', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  console.log('\n[ZedBackend] Server stopped gracefully.');
  process.exit(0);
});

startServer();
