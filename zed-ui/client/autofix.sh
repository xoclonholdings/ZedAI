#!/bin/bash
# ZedAI Frontend Autofix Script
# Comprehensive diagnosis and setup of ZedAI2 React interface

set -e

echo "🔍 ZedAI Frontend Comprehensive Autofix Starting..."

# Step 1: Clean up any conflicting processes
echo "🧹 Cleaning up conflicting processes..."
pkill -f "serve.js\|vite\|python.*http.server\|ZedAI" 2>/dev/null || true
sleep 2

# Step 2: Navigate to the correct React client
cd /workspaces/zed-front-end/zed-ui/client

# Step 3: Ensure dependencies are installed
echo "📦 Installing dependencies..."
npm install --silent

# Step 4: Build the React application
echo "🏗️  Building React application..."
npm run build

# Step 5: Create a reliable server script
echo "🚀 Creating optimized server..."
cat > autofix-server.js << 'EOF'
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const DIST_DIR = path.join(__dirname, 'dist');

console.log(`🎯 Serving from: ${DIST_DIR}`);
console.log(`📂 Files available:`);
try {
  fs.readdirSync(DIST_DIR).forEach(file => console.log(`  - ${file}`));
} catch (e) {
  console.error('❌ Dist directory not found');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  console.log(`📥 Request: ${req.method} ${req.url}`);
  
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(DIST_DIR, filePath);
  
  // Security check
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath)) {
    // For SPA routing, serve index.html
    if (!req.url.startsWith('/api/') && !path.extname(req.url)) {
      filePath = path.join(DIST_DIR, 'index.html');
    } else {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
  };

  const stats = fs.statSync(filePath);
  res.writeHead(200, { 
    'Content-Type': contentTypes[ext] || 'text/plain',
    'Content-Length': stats.size,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
  });
  
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ZedAI Frontend Server running on http://0.0.0.0:${PORT}/`);
  console.log(`🌐 Codespace URL: https://turbo-waffle-5g9v64j45j6gh7xrp-${PORT}.app.github.dev`);
  console.log(`🎮 VS Code Simple Browser ready!`);
});

// Keep server alive with heartbeat
setInterval(() => {
  console.log(`💓 Server heartbeat - ${new Date().toLocaleTimeString()}`);
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down ZedAI Frontend Server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
EOF

# Step 6: Start the server
echo "🚀 Starting ZedAI Frontend Server..."
node autofix-server.js &
SERVER_PID=$!

# Step 7: Wait for server to start
sleep 3

# Step 8: Test server
echo "🧪 Testing server..."
if curl -s localhost:3000 > /dev/null; then
  echo "✅ Server is responding!"
else
  echo "❌ Server not responding"
  exit 1
fi

# Step 9: Display success information
echo ""
echo "🎉 ZedAI Frontend Autofix Complete!"
echo "📍 Server PID: $SERVER_PID"
echo "🌐 Local URL: http://localhost:3000"
echo "🚀 Codespace URL: https://turbo-waffle-5g9v64j45j6gh7xrp-3000.app.github.dev"
echo "💡 Use VS Code Simple Browser with the Codespace URL"
echo ""
echo "🔧 To stop server: kill $SERVER_PID"