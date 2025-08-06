const http = require('http');
const url = require('url');

const PORT = 5001;

// Mock data
const mockData = {
  conversations: [
    {
      id: '1',
      title: 'Welcome to ZED',
      messageCount: 5,
      lastMessageDate: new Date().toISOString(),
      mode: 'chat'
    },
    {
      id: '2',
      title: 'AI Development Discussion',
      messageCount: 12,
      lastMessageDate: new Date(Date.now() - 86400000).toISOString(),
      mode: 'agent'
    }
  ],
  stats: {
    totalConversations: 2,
    totalMessages: 17,
    memoryUsage: '2.4 KB',
    lastSync: new Date().toISOString()
  }
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  console.log(`[${method}] ${path}`);

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Set CORS headers for all responses
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Route handling
  if (path === '/api/memory/conversations' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(mockData));
  }
  else if (path.startsWith('/api/memory/conversations/') && method === 'GET') {
    const id = path.split('/').pop();
    const conversation = mockData.conversations.find(c => c.id === id);
    if (conversation) {
      const response = {
        conversation,
        messages: [
          { id: '1', role: 'user', content: 'Hello ZED!', createdAt: new Date().toISOString() },
          { id: '2', role: 'assistant', content: 'Hello! How can I help you today?', createdAt: new Date().toISOString() }
        ]
      };
      res.writeHead(200);
      res.end(JSON.stringify(response));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Conversation not found' }));
    }
  }
  else if (path === '/api/memory/search' && method === 'GET') {
    const query = parsedUrl.query.q || '';
    const results = mockData.conversations
      .filter(conv => conv.title.toLowerCase().includes(query.toLowerCase()))
      .map(conv => ({
        id: conv.id,
        title: conv.title,
        snippet: `Search result for "${query}" in ${conv.title}`,
        date: conv.lastMessageDate,
        messageCount: conv.messageCount,
        type: 'conversation'
      }));

    res.writeHead(200);
    res.end(JSON.stringify({
      results,
      query,
      total: results.length
    }));
  }
  else if (path === '/api/memory/sync' && method === 'POST') {
    const response = {
      timestamp: new Date().toISOString(),
      conversationsSync: mockData.conversations.length,
      status: 'success',
      message: 'Mock sync completed'
    };
    res.writeHead(200);
    res.end(JSON.stringify(response));
  }
  else if (path === '/api/memory/health' && method === 'GET') {
    const response = {
      connected: true,
      database: 'mock-postgresql',
      lastSync: new Date().toISOString(),
      status: 'healthy',
      features: {
        conversationHistory: true,
        messageSearch: true,
        memorySync: true,
        zedCoreMemory: true
      }
    };
    res.writeHead(200);
    res.end(JSON.stringify(response));
  }
  // ZED Memory API endpoints for ChatArea functionality
  else if (path === '/api/zed-memory/recent' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      conversations: mockData.conversations.slice(0, 10)
    }));
  }
  else if (path === '/api/zed-memory/search' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      const { query } = JSON.parse(body);
      const results = mockData.conversations.map(conv => ({
        type: 'conversation',
        id: conv.id,
        title: conv.title,
        snippet: `Found "${query}" in conversation`,
        timestamp: conv.lastMessageDate
      }));
      res.writeHead(200);
      res.end(JSON.stringify({ results }));
    });
  }
  else if (path === '/api/zed-memory/sync' && method === 'POST') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      stats: {
        totalSize: "2.4 KB",
        messageCount: 17
      }
    }));
  }
  else if (path === '/api/zed-memory/sync-database' && method === 'POST') {
    res.writeHead(200);
    res.end(JSON.stringify({
      recordCount: 42,
      storageUsed: "3.2 MB"
    }));
  }
  else if (path === '/api/zed-memory/backup' && method === 'POST') {
    res.writeHead(200);
    res.end(JSON.stringify({
      data: {
        conversations: mockData.conversations,
        stats: mockData.stats,
        backupDate: new Date().toISOString()
      }
    }));
  }
  else if (path === '/api/zed-memory/restore' && method === 'POST') {
    res.writeHead(200);
    res.end(JSON.stringify({
      restoredCount: 25
    }));
  }
  // Satellite API endpoints
  else if (path === '/api/satellite/status' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      connected: true,
      signalStrength: 85,
      latency: 42,
      status: 'Optimal'
    }));
  }
  else if (path === '/api/satellite/boost' && method === 'POST') {
    res.writeHead(200);
    res.end(JSON.stringify({
      newSignalStrength: 95,
      boostedBy: 10
    }));
  }
  else if (path === '/api/satellite/diagnostics' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      latency: '42ms',
      status: 'Optimal'
    }));
  }
  else if (path === '/api/satellite/emergency' && method === 'POST') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      protocolId: `EMRG-${Date.now()}`
    }));
  }
  // Chat GIF API endpoint
  else if (path === '/api/chat/gif' && method === 'POST') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      messageId: Date.now(),
      gifProcessed: true
    }));
  }
  // Translation API endpoint
  else if (path === '/api/translate' && method === 'POST') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      translatedText: "Mock translation result",
      fromLanguage: "auto-detected",
      toLanguage: "specified"
    }));
  }
  // File upload API endpoint
  else if (path === '/api/upload' && method === 'POST') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      uploadedFiles: ["mock-file-1.txt", "mock-file-2.jpg"],
      totalSize: "2.4MB"
    }));
  }
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`[AGENT SERVER] Running on http://localhost:${PORT}`);
  console.log('[MEMORY API] Mock memory endpoints available');
  console.log('[DATABASE] Mock connection established');
});
