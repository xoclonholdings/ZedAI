import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain,
  Search,
  Calendar,
  MessageSquare,
  X,
  ChevronDown,
  ChevronRight,
  Bookmark,
  Upload,
  Settings,
  Archive
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuthProvider.tsx';

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
}

interface ZedCoreMemory {
  userId: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  authorizedEditors: string[];
  baseTemplate: string;

  personality: {
    baseTraits: Record<string, any>;
    learnedBehaviors: Record<string, any>;
    customizations: Record<string, any>;
  };

  conversations: Array<{
    id: string;
    title: string;
    messages: Array<{
      role: string;
      content: string;
      timestamp: string;
    }>;
    date: string;
    type: 'conversation';
  }>;

  uploads: Array<{
    id: string;
    filename: string;
    size: number;
    analysis: string;
    date: string;
    type: 'upload';
  }>;

  generations: Array<{
    id: string;
    prompt: string;
    response: string;
    date: string;
    type: 'generation';
  }>;

  bookmarks: Array<{
    id: string;
    title: string;
    content: string;
    tags: string[];
    date: string;
    type: 'bookmark';
  }>;
}

type MemoryEntry = ZedCoreMemory['conversations'][0] | ZedCoreMemory['uploads'][0] | ZedCoreMemory['generations'][0] | ZedCoreMemory['bookmarks'][0];

export default function MemoryPanel({ isOpen, onClose, username }: MemoryPanelProps) {
  const [memoryData, setMemoryData] = useState<ZedCoreMemory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const loadMemoryData = async () => {
    setLoading(true);
    setError(null);

    try {
      const targetUser = username || user?.name || 'sample-user';
      const response = await fetch(`/api/zed/memory/${targetUser}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMemoryData(data);
      } else if (response.status === 403) {
        setError('Access denied: You can only view your own memory or admin memories.');
      } else {
        setError('Failed to load memory data');
      }
    } catch (err) {
      console.error('Memory panel error:', err);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMemoryData();
    }
  }, [isOpen, username]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const toggleEntryExpansion = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const getEntryTitle = (entry: MemoryEntry): string => {
    if ('title' in entry) {
      return entry.title;
    } else if ('filename' in entry) {
      return entry.filename;
    }
    return 'Untitled';
  };

  // Combine all entries for filtering and searching
  const getAllEntries = (): MemoryEntry[] => {
    if (!memoryData) return [];

    return [
      ...memoryData.conversations,
      ...memoryData.uploads,
      ...memoryData.generations,
      ...memoryData.bookmarks
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const filteredEntries = getAllEntries().filter(entry => {
    const matchesType = selectedType === 'all' || entry.type === selectedType;

    let matchesSearch = searchQuery === '';
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if ('title' in entry) {
        matchesSearch = entry.title.toLowerCase().includes(query);
      } else if ('filename' in entry) {
        matchesSearch = entry.filename.toLowerCase().includes(query);
      }
    }

    return matchesType && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[90vh] bg-black/95 border border-purple-500/30 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <Brain className="h-6 w-6 text-purple-400" />
            <div>
              <h2 className="text-xl font-bold text-white">ZED Memory Vault</h2>
              <p className="text-sm text-muted-foreground">
                {username ? `Viewing ${username}'s memory` : 'Your personal memory vault'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-80 border-r border-white/10 p-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
              />
            </div>

            {/* Type Filter */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">Filter by Type</h3>
              <div className="space-y-2">
                {[
                  { id: 'all', label: 'All Memories', icon: Archive },
                  { id: 'conversation', label: 'Conversations', icon: MessageSquare },
                  { id: 'upload', label: 'File Uploads', icon: Upload },
                  { id: 'generation', label: 'AI Generations', icon: Settings },
                  { id: 'bookmark', label: 'Bookmarks', icon: Bookmark }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setSelectedType(id)}
                    className={`w-full flex items-center space-x-2 p-2 rounded-lg text-left transition-colors ${selectedType === id
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'hover:bg-white/5 text-muted-foreground'
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Memory Stats */}
            {memoryData && (
              <div className="p-4 bg-muted/20 border-b border-border">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-purple-400">
                      {getAllEntries().length}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Entries</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-pink-400">
                      {formatFileSize(JSON.stringify(memoryData).length)}
                    </div>
                    <div className="text-xs text-muted-foreground">Memory Size</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-cyan-400">
                      {new Date(memoryData.updatedAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground">Last Updated</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {loading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Brain className="h-12 w-12 text-purple-400 mx-auto mb-4 animate-pulse" />
                  <p className="text-muted-foreground">Loading memories...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <X className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-400">{error}</p>
                  <Button variant="outline" onClick={loadMemoryData} className="mt-4">
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {!loading && !error && memoryData && (
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-4">
                  {filteredEntries.length === 0 ? (
                    <div className="text-center py-8">
                      <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No memories found</p>
                    </div>
                  ) : (
                    filteredEntries.map((entry) => (
                      <Card key={entry.id} className="bg-white/5 border-white/10">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleEntryExpansion(entry.id)}
                                className="p-0 h-auto"
                              >
                                {expandedEntries.has(entry.id) ?
                                  <ChevronDown className="h-3 w-3" /> :
                                  <ChevronRight className="h-3 w-3" />
                                }
                              </Button>
                              <CardTitle className="text-sm">{getEntryTitle(entry)}</CardTitle>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {entry.type}
                              </Badge>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(entry.date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        {expandedEntries.has(entry.id) && (
                          <CardContent className="pt-0">
                            {entry.type === 'conversation' && 'messages' in entry && entry.messages && (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {entry.messages.map((msg: any, idx: number) => (
                                  <div key={idx} className={`text-xs p-2 rounded ${msg.role === 'user'
                                    ? 'bg-blue-500/10 border-l-2 border-blue-500'
                                    : 'bg-purple-500/10 border-l-2 border-purple-500'
                                    }`}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium capitalize">{msg.role}</span>
                                      <span className="text-muted-foreground">
                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                      </span>
                                    </div>
                                    <div className="text-muted-foreground">
                                      {msg.content.substring(0, 300)}
                                      {msg.content.length > 300 && '...'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {entry.type === 'upload' && 'analysis' in entry && (
                              <div className="text-sm text-muted-foreground">
                                <p><strong>File:</strong> {'filename' in entry ? entry.filename : 'Unknown'}</p>
                                <p><strong>Analysis:</strong> {entry.analysis}</p>
                              </div>
                            )}

                            {entry.type === 'generation' && 'prompt' in entry && (
                              <div className="text-sm text-muted-foreground space-y-2">
                                <div>
                                  <strong>Prompt:</strong>
                                  <p className="mt-1 p-2 bg-blue-500/10 rounded">{entry.prompt}</p>
                                </div>
                                <div>
                                  <strong>Response:</strong>
                                  <p className="mt-1 p-2 bg-purple-500/10 rounded">{entry.response}</p>
                                </div>
                              </div>
                            )}

                            {entry.type === 'bookmark' && 'content' in entry && (
                              <div className="text-sm text-muted-foreground">
                                <p>{entry.content}</p>
                                {'tags' in entry && entry.tags && entry.tags.length > 0 && (
                                  <div className="flex gap-1 mt-2">
                                    {entry.tags.map((tag: string) => (
                                      <Badge key={tag} variant="secondary" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}

            {!loading && !error && !memoryData && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No memory data available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
