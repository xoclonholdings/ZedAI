// Simple backend server for memory functionality
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();
const PORT = 5001;

// Middleware
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Mock data for testing
const mockConversations = [
    {
        id: '1',
        title: 'Welcome to ZED',
        messageCount: 5,
        lastMessageDate: new Date(),
        mode: 'chat'
    },
    {
        id: '2',
        title: 'AI Development Discussion',
        messageCount: 12,
        lastMessageDate: new Date(Date.now() - 86400000), // 1 day ago
        mode: 'agent'
    }
];

const mockStats = {
    totalConversations: 2,
    totalMessages: 17,
    memoryUsage: '2.4 KB',
    lastSync: new Date()
};

// Memory API routes
app.get('/api/memory/conversations', (req, res) => {
    console.log('[MEMORY API] GET /api/memory/conversations');
    res.json({
        conversations: mockConversations,
        stats: mockStats
    });
});

app.get('/api/memory/conversations/:id', (req, res) => {
    console.log(`[MEMORY API] GET /api/memory/conversations/${req.params.id}`);
    const conversation = mockConversations.find(c => c.id === req.params.id);
    if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
        conversation,
        messages: [
            { id: '1', role: 'user', content: 'Hello ZED!', createdAt: new Date() },
            { id: '2', role: 'assistant', content: 'Hello! How can I help you today?', createdAt: new Date() }
        ]
    });
});

app.get('/api/memory/search', (req, res) => {
    console.log(`[MEMORY API] GET /api/memory/search?q=${req.query.q}`);
    const query = req.query.q;

    if (!query) {
        return res.status(400).json({ error: 'Search query required' });
    }

    // Simple mock search
    const results = mockConversations
        .filter(conv => conv.title.toLowerCase().includes(query.toLowerCase()))
        .map(conv => ({
            id: conv.id,
            title: conv.title,
            snippet: `Search result for "${query}" in ${conv.title}`,
            date: conv.lastMessageDate,
            messageCount: conv.messageCount,
            type: 'conversation'
        }));

    res.json({
        results,
        query,
        total: results.length
    });
});

app.post('/api/memory/sync', (req, res) => {
    console.log('[MEMORY API] POST /api/memory/sync');
    res.json({
        timestamp: new Date(),
        conversationsSync: mockConversations.length,
        status: 'success',
        message: 'Mock sync completed'
    });
});

app.get('/api/memory/health', (req, res) => {
    console.log('[MEMORY API] GET /api/memory/health');
    res.json({
        connected: true,
        database: 'mock-postgresql',
        lastSync: new Date(),
        status: 'healthy',
        features: {
            conversationHistory: true,
            messageSearch: true,
            memorySync: true,
            zedCoreMemory: true
        }
    });
});

app.post('/api/memory/github-sync', (req, res) => {
    console.log('[MEMORY API] POST /api/memory/github-sync');
    res.json({
        repository: 'xoclonholdings/zebulon-database',
        branch: 'main',
        lastCommit: 'abc123...',
        syncedAt: new Date(),
        status: 'success',
        message: 'Mock GitHub sync completed'
    });
});

// Error handling
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`[AGENT SERVER] Running on http://localhost:${PORT}`);
    console.log('[MEMORY API] Mock memory endpoints available');
    console.log('[DATABASE] Mock connection established');
});
