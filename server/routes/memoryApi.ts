import { Router } from 'express';
import { PostgreSQLStorage } from '../oracleStorage';

const router = Router();
const storage = new PostgreSQLStorage();

/**
 * GET /api/memory/conversations
 * Get all conversations for the current user with summary stats
 */
router.get('/conversations', async (req, res) => {
    try {
        // In a real app, get user ID from session/auth
        const userId = (req.session as any)?.user?.id || 'default-user';

        // Get conversations from database
        const conversations = await storage.getConversations(userId);        // Transform conversations to include summary data
        // Transform conversations to include summary data
        const conversationSummaries = await Promise.all(
            conversations.map(async (conv) => {
                const messages = await storage.getMessages(conv.id);
                return {
                    id: conv.id,
                    title: conv.title,
                    messageCount: messages.length,
                    lastMessageDate: messages.length > 0
                        ? new Date(Math.max(...messages.map(m => new Date(m.createdAt || '').getTime())))
                        : conv.updatedAt,
                    mode: conv.mode || 'chat'
                };
            })
        );

        // Calculate stats
        const totalMessages = conversationSummaries.reduce((sum, conv) => sum + conv.messageCount, 0);
        const memoryUsageKB = Math.round((JSON.stringify(conversations).length + totalMessages * 100) / 1024);

        const stats = {
            totalConversations: conversations.length,
            totalMessages,
            memoryUsage: `${memoryUsageKB} KB`,
            lastSync: new Date()
        };

        res.json({
            conversations: conversationSummaries,
            stats
        });

    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({
            error: 'Failed to fetch conversations',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/memory/conversations/:id
 * Get specific conversation with full message history
 */
router.get('/conversations/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get conversation
        const conversation = await storage.getConversation(id);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Get messages
        const messages = await storage.getMessages(id); res.json({
            conversation,
            messages
        });

    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({
            error: 'Failed to fetch conversation',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/memory/search
 * Search conversations and messages
 */
router.get('/search', async (req, res) => {
    try {
        const { q: query } = req.query;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Search query required' });
        }

        const userId = (req.session as any)?.user?.id || 'default-user';

        // Get all conversations for user
        const conversations = await storage.getConversations(userId);

        // Search through conversations and messages
        const results: any[] = [];

        for (const conv of conversations) {
            const messages = await storage.getMessages(conv.id);            // Check if conversation title matches
            if (conv.title.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                    id: conv.id,
                    title: conv.title,
                    snippet: `Title match: ${conv.title}`,
                    date: conv.updatedAt,
                    messageCount: messages.length,
                    type: 'conversation'
                });
            }

            // Check messages for content matches
            for (const message of messages) {
                if (message.content.toLowerCase().includes(query.toLowerCase())) {
                    const snippet = message.content.substring(0, 100) + '...';
                    results.push({
                        id: `${conv.id}-${message.id}`,
                        title: conv.title,
                        snippet: `Message: ${snippet}`,
                        date: message.createdAt || conv.updatedAt,
                        messageCount: messages.length,
                        type: 'message',
                        messageId: message.id
                    });
                }
            }
        }

        // Sort by relevance/date
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        res.json({
            results: results.slice(0, 50), // Limit results
            query,
            total: results.length
        });

    } catch (error) {
        console.error('Error searching conversations:', error);
        res.status(500).json({
            error: 'Search failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * POST /api/memory/sync
 * Sync with Zebulon database (force refresh)
 */
router.post('/sync', async (req, res) => {
    try {
        const userId = (req.session as any)?.user?.id || 'default-user';

        // In a real implementation, this would:
        // 1. Connect to your GitHub Zebulon repository
        // 2. Pull latest data
        // 3. Sync with local database
        // 4. Update memory indexes

        // For now, we'll just refresh the local data
        const conversations = await storage.getConversations(userId);        // Update sync timestamp (you might store this in the database)
        const syncResult = {
            timestamp: new Date(),
            conversationsSync: conversations.length,
            status: 'success',
            message: 'Local database synchronized'
        };

        res.json(syncResult);

    } catch (error) {
        console.error('Error syncing memory:', error);
        res.status(500).json({
            error: 'Sync failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/memory/health
 * Check database connection and memory system health
 */
router.get('/health', async (req, res) => {
    try {
        // Test database connection
        const testConversation = await storage.getConversations('test'); const health = {
            connected: true,
            database: 'neon-postgresql',
            lastSync: new Date(),
            status: 'healthy',
            features: {
                conversationHistory: true,
                messageSearch: true,
                memorySync: true,
                zedCoreMemory: true
            }
        };

        res.json(health);

    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            connected: false,
            error: 'Database connection failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * POST /api/memory/github-sync
 * Sync with GitHub Zebulon repository
 */
router.post('/github-sync', async (req, res) => {
    try {
        // This would be where you implement GitHub integration
        // For now, return a placeholder response

        const githubSync = {
            repository: 'xoclonholdings/zebulon-database',
            branch: 'main',
            lastCommit: 'abc123...',
            syncedAt: new Date(),
            status: 'success',
            message: 'GitHub sync not yet implemented - using local database'
        };

        res.json(githubSync);

    } catch (error) {
        console.error('GitHub sync failed:', error);
        res.status(500).json({
            error: 'GitHub sync failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export { router as memoryApiRoutes };
