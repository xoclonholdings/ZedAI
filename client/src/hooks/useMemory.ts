import { useState, useEffect } from 'react';

export interface ConversationSummary {
    id: string;
    title: string;
    messageCount: number;
    lastMessageDate: Date;
    mode?: 'chat' | 'agent';
}

export interface MemoryStats {
    totalConversations: number;
    totalMessages: number;
    memoryUsage: string;
    lastSync: Date;
}

export interface ZebulonConnection {
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
    lastSync: Date | null;
    syncInProgress: boolean;
}

export function useMemory() {
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
    const [zebulonConnection, setZebulonConnection] = useState<ZebulonConnection>({
        status: 'disconnected',
        lastSync: null,
        syncInProgress: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch conversations from the Zebulon database
    const fetchConversations = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/memory-panel/conversations', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch conversations: ${response.statusText}`);
            }

            const data = await response.json();
            setConversations(data.conversations || []);
            setMemoryStats(data.stats || null);

            // Update connection status based on successful fetch
            setZebulonConnection(prev => ({
                ...prev,
                status: 'connected',
                lastSync: new Date()
            }));

        } catch (err) {
            console.error('Error fetching conversations:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
            setZebulonConnection(prev => ({
                ...prev,
                status: 'error'
            }));
        } finally {
            setLoading(false);
        }
    };

    // Sync with Zebulon database
    const syncWithZebulon = async () => {
        try {
            setZebulonConnection(prev => ({
                ...prev,
                syncInProgress: true,
                status: 'connecting'
            }));

            const response = await fetch('/api/memory-panel/sync', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Sync failed: ${response.statusText}`);
            }

            const result = await response.json();

            setZebulonConnection({
                status: 'connected',
                lastSync: new Date(),
                syncInProgress: false
            });

            // Refresh conversations after sync
            await fetchConversations();

            return result;

        } catch (err) {
            console.error('Error syncing with Zebulon:', err);
            setError(err instanceof Error ? err.message : 'Sync failed');
            setZebulonConnection(prev => ({
                ...prev,
                status: 'error',
                syncInProgress: false
            }));
            throw err;
        }
    };

    // Search conversations
    const searchConversations = async (query: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/memory-panel/search?q=${encodeURIComponent(query)}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.results || [];

        } catch (err) {
            console.error('Error searching conversations:', err);
            setError(err instanceof Error ? err.message : 'Search failed');
            return [];
        } finally {
            setLoading(false);
        }
    };

    // Get specific conversation details
    const getConversation = async (conversationId: string) => {
        try {
            const response = await fetch(`/api/memory-panel/conversations/${conversationId}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch conversation: ${response.statusText}`);
            }

            return await response.json();

        } catch (err) {
            console.error('Error fetching conversation:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch conversation');
            return null;
        }
    };

    // Check Zebulon database connection
    const checkConnection = async () => {
        try {
            setZebulonConnection(prev => ({
                ...prev,
                status: 'connecting'
            }));

            const response = await fetch('/api/memory-panel/health', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Health check failed: ${response.statusText}`);
            }

            const health = await response.json();
            setZebulonConnection({
                status: health.connected ? 'connected' : 'disconnected',
                lastSync: health.lastSync ? new Date(health.lastSync) : null,
                syncInProgress: false
            });

            return health;

        } catch (err) {
            console.error('Error checking connection:', err);
            setZebulonConnection(prev => ({
                ...prev,
                status: 'error',
                syncInProgress: false
            }));
            return { connected: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    };

    // Auto-check connection on hook initialization
    useEffect(() => {
        checkConnection();
    }, []);

    return {
        conversations,
        memoryStats,
        zebulonConnection,
        loading,
        error,
        fetchConversations,
        syncWithZebulon,
        searchConversations,
        getConversation,
        checkConnection,
        clearError: () => setError(null)
    };
}
