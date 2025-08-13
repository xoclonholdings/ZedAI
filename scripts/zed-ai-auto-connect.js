const axios = require("axios");
const WebSocket = require("ws");
const fs = require("fs");

const API_URL = process.env.ZED_AI_API_URL || "http://localhost:5000";
const WS_URL = process.env.ZED_AI_WS_URL || "ws://localhost:5001";

async function verifyApi() {
  try {
    const res = await axios.get(`${API_URL}/health`);
    log(`API Health Check: ${res.status} ${res.data.status}`);
  } catch (err) {
    log(`API Health Check Failed: ${err.message}`);
    process.exit(1);
  }
}

function verifyWebSocket() {
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    log("WebSocket connected to ZED AI");
    ws.send(JSON.stringify({ type: "test", payload: "ping" }));
  });

  ws.on("message", (msg) => {
    log(`WebSocket message received: ${msg}`);
    ws.close();
  });

  ws.on("error", (err) => {
    log(`WebSocket error: ${err.message}`);
    process.exit(1);
  });

  ws.on("close", () => {
    log("WebSocket closed successfully");
  });
}

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
  fs.appendFileSync("zed-ai-connection.log", `[${timestamp}] ${msg}\n`);
}

async function main() {
  console.log("🚀 Verifying ZED AI Connection...");
  await verifyApi();
  verifyWebSocket();
}

main();
