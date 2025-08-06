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
