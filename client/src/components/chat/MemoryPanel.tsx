import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/    try {
      const targetUser = username || user?.username || 'sample-user';
      const response = await apiRequest(`/api/zed/memory/${targetUser}`, {
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
    } catch (err) {/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  Search, 
  Heart, 
  Calendar, 
  MessageSquare, 
  X, 
  ChevronDown, 
  ChevronRight,
  Clock,
  Database,
  User,
  Lock
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import type { User as UserType } from '@/types/auth';

interface ZedMemoryEntry {
  id: string;
  timestamp: string;
  type: 'conversation' | 'preference' | 'upload' | 'generation' | 'bookmark' | 'role';
  content: any;
  metadata?: Record<string, any>;
}

interface ZedConversation {
  id: string;
  route: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    attachments?: string[];
  }>;
  createdAt: string;
  updatedAt: string;
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
  
  conversations: ZedConversation[];
  uploads: Array<{
    id: string;
    filename: string;
    path: string;
    type: string;
    uploadedAt: string;
    metadata?: Record<string, any>;
  }>;
  
  generations: Array<{
    id: string;
    type: 'document' | 'code' | 'image' | 'analysis';
    title: string;
    path: string;
    generatedAt: string;
    prompt: string;
    metadata?: Record<string, any>;
  }>;
  
  bookmarks: Array<{
    id: string;
    title: string;
    url?: string;
    content?: string;
    tags: string[];
    createdAt: string;
  }>;
  
  memoryEntries: ZedMemoryEntry[];
}

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
}

export default function MemoryPanel({ isOpen, onClose, username }: MemoryPanelProps) {
  const [memoryData, setMemoryData] = useState<ZedCoreMemory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Load memory data when panel opens
  useEffect(() => {
    if (isOpen && username) {
      loadMemoryData();
    }
  }, [isOpen, username]);

  const loadMemoryData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const targetUser = username || (user as any)?.username || 'sample-user';
      const response = await apiRequest(`/api/zed/memory/${targetUser}`);
      
      if (response.ok) {
        const data = await response.json();
        setMemoryData(data);
      } else if (response.status === 403) {
        setError('Access denied: You can only view your own memory or admin memories.');
      } else {
        setError('Failed to load memory data');
      }
    } catch (err) {
      setError('Error loading memory: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Combine all data sources for unified search
  const allEntries = memoryData ? [
    // Conversations
    ...memoryData.conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      type: 'conversation' as const,
      date: conv.updatedAt,
      content: conv.messages.map(m => m.content).join(' ').substring(0, 500),
      isFavorited: false, // TODO: Implement favorites
      messages: conv.messages,
      route: conv.route
    })),
    // Memory Entries
    ...memoryData.memoryEntries.map(entry => ({
      id: entry.id,
      title: `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} Entry`,
      type: entry.type,
      date: entry.timestamp,
      content: typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content).substring(0, 500),
      isFavorited: false, // TODO: Implement favorites
      metadata: entry.metadata
    })),
    // Bookmarks
    ...memoryData.bookmarks.map(bookmark => ({
      id: bookmark.id,
      title: bookmark.title,
      type: 'bookmark' as const,
      date: bookmark.createdAt,
      content: bookmark.content || bookmark.url || '',
      isFavorited: true, // Bookmarks are inherently favorited
      url: bookmark.url,
      tags: bookmark.tags
    })),
    // Uploads
    ...memoryData.uploads.map(upload => ({
      id: upload.id,
      title: upload.filename,
      type: 'upload' as const,
      date: upload.uploadedAt,
      content: `File: ${upload.filename} (${upload.type})`,
      isFavorited: false,
      filename: upload.filename,
      path: upload.path,
      fileType: upload.type
    })),
    // Generations
    ...memoryData.generations.map(gen => ({
      id: gen.id,
      title: gen.title,
      type: 'generation' as const,
      date: gen.generatedAt,
      content: gen.prompt,
      isFavorited: false,
      prompt: gen.prompt,
      generationType: gen.type
    }))
  ] : [];

  // Filter entries based on search and favorites
  const filteredEntries = allEntries.filter(entry => {
    const matchesSearch = !searchTerm || 
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFavorites = !showFavoritesOnly || entry.isFavorited;
    
    return matchesSearch && matchesFavorites;
  });

  const formatFileSize = (sizeInBytes: number) => {
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toggleFavorite = async (entryId: string) => {
    // TODO: Implement favorite toggle API call
    console.log('Toggle favorite for entry:', entryId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-background border-l border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-purple-500/10 to-pink-500/10">
          <div className="flex items-center space-x-3">
            <Brain className="h-6 w-6 text-purple-400" />
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ZED Memory
              </h2>
              <p className="text-sm text-muted-foreground">
                {username ? `${username}'s Memory Core` : 'Personal Memory Core'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Brain className="h-12 w-12 text-purple-400 animate-pulse mx-auto mb-4" />
                <p className="text-muted-foreground">Loading memory data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-400">
                <Lock className="h-12 w-12 mx-auto mb-4" />
                <p>{error}</p>
              </div>
            </div>
          ) : memoryData ? (
            <div className="h-full flex flex-col">
              {/* Summary Panel */}
              <div className="p-4 bg-muted/20 border-b border-border">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-purple-400">
                      {allEntries.length}
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

              {/* Search and Filters */}
              <div className="p-4 border-b border-border space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search memories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant={showFavoritesOnly ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className="text-xs"
                  >
                    <Heart className={`h-3 w-3 mr-1 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                    Favorites Only
                  </Button>
                  <Badge variant="outline" className="text-xs">
                    {filteredEntries.length} entries
                  </Badge>
                </div>
              </div>

              {/* Memory Entries */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {filteredEntries.map((entry) => (
                    <Card key={entry.id} className="border-border/50 hover:border-purple-500/30 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedEntry(
                                  expandedEntry === entry.id ? null : entry.id
                                )}
                                className="h-6 w-6 p-0"
                              >
                                {expandedEntry === entry.id ? 
                                  <ChevronDown className="h-3 w-3" /> : 
                                  <ChevronRight className="h-3 w-3" />
                                }
                              </Button>
                              <CardTitle className="text-sm">{entry.title}</CardTitle>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {entry.type}
                              </Badge>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(entry.date).toLocaleDateString()}
                              </div>
                              {entry.type === 'conversation' && 'messages' in entry && entry.messages && (
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  {entry.messages.length} messages
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleFavorite(entry.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Heart className={`h-3 w-3 ${entry.isFavorited ? 'fill-current text-red-400' : ''}`} />
                          </Button>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {entry.content.substring(0, 150)}...
                        </p>
                        
                        {expandedEntry === entry.id && (
                          <div className="mt-4 pt-4 border-t border-border/50">
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-sm font-medium mb-2">
                                  {entry.type === 'conversation' ? 'Messages:' : 'Content:'}
                                </h4>
                                
                                {entry.type === 'conversation' && 'messages' in entry && entry.messages ? (
                                  <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {entry.messages.map((msg: any, idx: number) => (
                                      <div key={idx} className={`text-xs p-2 rounded ${
                                        msg.role === 'user' 
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
                                ) : (
                                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                                    {entry.content}
                                  </div>
                                )}
                              </div>
                              
                              {/* Additional metadata based on entry type */}
                              {entry.type === 'bookmark' && (entry as any).url && (
                                <div>
                                  <h4 className="text-sm font-medium mb-1">URL:</h4>
                                  <a href={(entry as any).url} target="_blank" rel="noopener noreferrer" 
                                     className="text-xs text-blue-400 hover:underline">
                                    {(entry as any).url}
                                  </a>
                                </div>
                              )}
                              
                              {entry.type === 'upload' && (
                                <div>
                                  <h4 className="text-sm font-medium mb-1">File Info:</h4>
                                  <div className="text-xs text-muted-foreground">
                                    Type: {(entry as any).fileType}<br/>
                                    Path: {(entry as any).path}
                                  </div>
                                </div>
                              )}
                              
                              {entry.type === 'generation' && (
                                <div>
                                  <h4 className="text-sm font-medium mb-1">Generation Type:</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {(entry as any).generationType}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  
                  {filteredEntries.length === 0 && (
                    <div className="text-center py-12">
                      <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {searchTerm || showFavoritesOnly 
                          ? 'No memories match your filters' 
                          : 'No memories found'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
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
  );
}
