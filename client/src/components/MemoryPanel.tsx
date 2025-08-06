import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMemory } from '@/hooks/useMemory';
import {
    Brain,
    Search,
    RefreshCw,
    Database,
    Clock,
    MessageSquare,
    X,
    WifiOff,
    AlertCircle,
    CheckCircle
} from 'lucide-react';

interface MemoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function MemoryPanel({ isOpen, onClose }: MemoryPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'conversations' | 'search'>('overview');

    const {
        conversations,
        memoryStats,
        zebulonConnection,
        loading,
        error,
        fetchConversations,
        syncWithZebulon,
        searchConversations,
        checkConnection,
        clearError
    } = useMemory();

    useEffect(() => {
        if (isOpen && conversations.length === 0) {
            fetchConversations();
        }
    }, [isOpen]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        const results = await searchConversations(searchQuery);
        setSearchResults(results);
        setActiveTab('search');
    };

    const handleSync = async () => {
        try {
            await syncWithZebulon();
        } catch (err) {
            // Error is handled by the hook
        }
    };

    const getConnectionIcon = () => {
        switch (zebulonConnection.status) {
            case 'connected':
                return <CheckCircle size={16} className="text-green-400" />;
            case 'connecting':
                return <RefreshCw size={16} className="text-yellow-400 animate-spin" />;
            case 'disconnected':
                return <WifiOff size={16} className="text-gray-400" />;
            case 'error':
                return <AlertCircle size={16} className="text-red-400" />;
            default:
                return <Database size={16} className="text-gray-400" />;
        }
    };

    const getConnectionStatus = () => {
        switch (zebulonConnection.status) {
            case 'connected':
                return 'Connected to Zebulon DB';
            case 'connecting':
                return 'Connecting...';
            case 'disconnected':
                return 'Disconnected';
            case 'error':
                return 'Connection Error';
            default:
                return 'Unknown Status';
        }
    };

    const formatDate = (date: Date | null) => {
        if (!date) return 'Never';
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900/95 border border-white/10 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center space-x-3">
                        <Brain className="text-purple-400" size={20} />
                        <h2 className="text-lg font-semibold text-white">Memory & Chat History</h2>
                        <div className="flex items-center space-x-2 text-sm">
                            {getConnectionIcon()}
                            <span className="text-gray-300">{getConnectionStatus()}</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSync}
                            disabled={zebulonConnection.syncInProgress}
                            className="text-cyan-400 hover:text-cyan-300"
                        >
                            <RefreshCw
                                size={16}
                                className={zebulonConnection.syncInProgress ? 'animate-spin' : ''}
                            />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
                            <X size={16} />
                        </Button>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500/30 text-red-300 p-3 m-4 rounded-lg flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <AlertCircle size={16} />
                            <span className="text-sm">{error}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={clearError} className="text-red-300">
                            <X size={14} />
                        </Button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    {[
                        { id: 'overview', label: 'Overview', icon: Database },
                        { id: 'conversations', label: 'Conversations', icon: MessageSquare },
                        { id: 'search', label: 'Search', icon: Search }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center space-x-2 px-4 py-3 text-sm transition-colors ${activeTab === tab.id
                                    ? 'border-b-2 border-purple-400 text-purple-300 bg-purple-500/10'
                                    : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            <tab.icon size={16} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 max-h-[calc(90vh-200px)]">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Connection Status Card */}
                            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <h3 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
                                    <Database size={16} className="text-cyan-400" />
                                    <span>Zebulon Database Status</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-400">Connection</p>
                                        <p className="text-white font-medium">{getConnectionStatus()}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400">Last Sync</p>
                                        <p className="text-white font-medium">{formatDate(zebulonConnection.lastSync)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400">Auto-Sync</p>
                                        <p className="text-green-400 font-medium">Enabled</p>
                                    </div>
                                </div>
                            </div>

                            {/* Memory Stats */}
                            {memoryStats && (
                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                    <h3 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
                                        <Brain size={16} className="text-purple-400" />
                                        <span>Memory Statistics</span>
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-400">Conversations</p>
                                            <p className="text-white font-medium text-lg">{memoryStats.totalConversations}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Messages</p>
                                            <p className="text-white font-medium text-lg">{memoryStats.totalMessages}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Memory Usage</p>
                                            <p className="text-white font-medium text-lg">{memoryStats.memoryUsage}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Last Updated</p>
                                            <p className="text-white font-medium">{formatDate(memoryStats.lastSync)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Quick Actions */}
                            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <h3 className="text-sm font-medium text-white mb-3">Quick Actions</h3>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setActiveTab('conversations')}
                                        className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                                    >
                                        View Recent Conversations
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSync}
                                        disabled={zebulonConnection.syncInProgress}
                                        className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                                    >
                                        Force Sync
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={checkConnection}
                                        className="border-gray-500/30 text-gray-300 hover:bg-gray-500/20"
                                    >
                                        Test Connection
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Conversations Tab */}
                    {activeTab === 'conversations' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-white">Recent Conversations</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchConversations}
                                    disabled={loading}
                                    className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                                >
                                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                    Refresh
                                </Button>
                            </div>

                            {loading && conversations.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                                    <p>Loading conversations...</p>
                                </div>
                            ) : conversations.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                                    <p>No conversations found</p>
                                    <p className="text-sm">Start chatting to see your history here</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {conversations.map((conversation) => (
                                        <div
                                            key={conversation.id}
                                            className="bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-medium text-white truncate">
                                                        {conversation.title}
                                                    </h4>
                                                    <div className="flex items-center space-x-4 text-xs text-gray-400 mt-1">
                                                        <span>{conversation.messageCount} messages</span>
                                                        <span className="flex items-center space-x-1">
                                                            <Clock size={12} />
                                                            <span>{formatDate(conversation.lastMessageDate)}</span>
                                                        </span>
                                                        {conversation.mode && (
                                                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                                                                {conversation.mode}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Search Tab */}
                    {activeTab === 'search' && (
                        <div className="space-y-4">
                            <div className="flex space-x-2">
                                <Input
                                    placeholder="Search conversations and messages..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                                />
                                <Button
                                    onClick={handleSearch}
                                    disabled={!searchQuery.trim() || loading}
                                    className="bg-purple-500 hover:bg-purple-600"
                                >
                                    <Search size={16} />
                                </Button>
                            </div>

                            {searchResults.length > 0 ? (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-white">
                                        Search Results ({searchResults.length})
                                    </h3>
                                    {searchResults.map((result: any) => (
                                        <div
                                            key={result.id}
                                            className="bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                                        >
                                            <h4 className="text-sm font-medium text-white">{result.title}</h4>
                                            <p className="text-xs text-gray-400 mt-1">{result.snippet}</p>
                                            <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                                                <span>{formatDate(new Date(result.date))}</span>
                                                <span>{result.messageCount} messages</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : searchQuery && !loading ? (
                                <div className="text-center py-8 text-gray-400">
                                    <Search size={24} className="mx-auto mb-2 opacity-50" />
                                    <p>No results found for "{searchQuery}"</p>
                                    <p className="text-sm">Try different keywords or check your connection</p>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Search size={24} className="mx-auto mb-2 opacity-50" />
                                    <p>Search your chat history and AI memories</p>
                                    <p className="text-sm">Enter keywords to find conversations and messages</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
