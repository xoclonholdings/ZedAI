import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { AlertCircle, Brain, Upload, Download, Eye, Settings, BookmarkPlus, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface ZedCorePageProps {
  userId: string;
  isAdmin?: boolean;
}

interface ZedMemoryStats {
  totalEntries: number;
  totalConversations: number;
  totalUploads: number;
  totalGenerations: number;
  totalBookmarks: number;
  memorySize: number;
  lastCompression?: string;
}

interface AdminCore {
  version: string;
  basePersonality: any;
  defaultModules: string[];
  defaultPreferences: any;
}

interface UserCore {
  userId: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  personality: any;
  conversations: any[];
  uploads: any[];
  generations: any[];
  preferences: any;
  bookmarks: any[];
  roles: any[];
}

export const ZedCorePage: React.FC<ZedCorePageProps> = ({ userId }) => {
  const [userCore, setUserCore] = useState<UserCore | null>(null);
  const [adminCore, setAdminCore] = useState<AdminCore | null>(null);
  const [memoryStats, setMemoryStats] = useState<ZedMemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);

  // Form states
  const [newBookmark, setNewBookmark] = useState({ title: '', url: '', tags: '' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [preferences, setPreferences] = useState<any>({});

  useEffect(() => {
    loadZedCore();
  }, [userId]);

  const loadZedCore = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load user core
      const userResponse = await fetch(`/api/zed/memory/${userId}`, {
        headers: { 'x-user-id': userId }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUserCore(userData);
        setPreferences(userData.preferences);
      }

      // Load admin core
      const adminResponse = await fetch('/api/zed/memory/admin', {
        headers: { 'x-user-id': userId }
      });
      
      if (adminResponse.ok) {
        const adminData = await adminResponse.json();
        setAdminCore(adminData);
      }

      // Load memory stats
      const statsResponse = await fetch(`/api/zed/memory/${userId}/stats`, {
        headers: { 'x-user-id': userId }
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setMemoryStats(statsData);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompress = async () => {
    try {
      setIsCompressing(true);
      setCompressionProgress(0);

      // Simulate compression progress
      const progressInterval = setInterval(() => {
        setCompressionProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`/api/zed/memory/${userId}/compress`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId 
        }
      });

      clearInterval(progressInterval);
      setCompressionProgress(100);

      if (response.ok) {
        await loadZedCore(); // Reload data
        setTimeout(() => {
          setIsCompressing(false);
          setCompressionProgress(0);
        }, 1000);
      } else {
        throw new Error('Compression failed');
      }
    } catch (err: any) {
      setError(err.message);
      setIsCompressing(false);
      setCompressionProgress(0);
    }
  };

  const handleAddBookmark = async () => {
    try {
      const response = await fetch(`/api/zed/memory/${userId}/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          title: newBookmark.title,
          url: newBookmark.url,
          tags: newBookmark.tags.split(',').map(t => t.trim())
        })
      });

      if (response.ok) {
        setNewBookmark({ title: '', url: '', tags: '' });
        await loadZedCore();
      } else {
        throw new Error('Failed to add bookmark');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('userId', userId);

      const response = await fetch(`/api/zed/memory/${userId}/upload`, {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: formData
      });

      if (response.ok) {
        setUploadFile(null);
        await loadZedCore();
      } else {
        throw new Error('Upload failed');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdatePreferences = async () => {
    try {
      const response = await fetch(`/api/zed/memory/${userId}/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        await loadZedCore();
      } else {
        throw new Error('Failed to update preferences');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Brain className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading ZED Core...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-blue-600" />
            ZED Core Memory
          </h1>
          <p className="text-gray-600 mt-1">
            Personal AI memory and knowledge management
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleCompress} 
            disabled={isCompressing}
            variant="outline"
          >
            {/* Compress icon removed: missing import */}
            {isCompressing ? 'Compressing...' : 'Compress Memory'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Compression Progress */}
      {isCompressing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Compressing memory...</span>
                <span>{compressionProgress}%</span>
              </div>
              <Progress value={compressionProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
          <TabsTrigger value="generations">Generations</TabsTrigger>
          <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Memory Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Memory Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {memoryStats && (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Conversations</p>
                        <p className="font-semibold">{memoryStats.totalConversations}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Uploads</p>
                        <p className="font-semibold">{memoryStats.totalUploads}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Generations</p>
                        <p className="font-semibold">{memoryStats.totalGenerations}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Bookmarks</p>
                        <p className="font-semibold">{memoryStats.totalBookmarks}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-gray-600 text-sm">Memory Size</p>
                      <p className="font-semibold">{formatBytes(memoryStats.memorySize)}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Admin Core Summary */}
            {adminCore && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Admin ZED Core</CardTitle>
                  <CardDescription>Base template and knowledge</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Version</p>
                    <Badge variant="secondary">{adminCore.version}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Default Modules</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {adminCore.defaultModules.map(module => (
                        <Badge key={module} variant="outline" className="text-xs">
                          {module}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="h-3 w-3 mr-1" />
                    View Details
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* User Core Info */}
            {userCore && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your ZED Instance</CardTitle>
                  <CardDescription>Personal AI core</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="text-sm">{new Date(userCore.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="text-sm">{new Date(userCore.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Roles</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {userCore.roles.map(role => (
                        <Badge key={role.id} variant="outline" className="text-xs">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
              <CardDescription>
                Your chat history and threaded conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userCore?.conversations.length ? (
                <div className="space-y-3">
                  {userCore.conversations.slice(0, 10).map(conversation => (
                    <div key={conversation.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{conversation.title}</h4>
                          <p className="text-sm text-gray-600">Route: {conversation.route}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {conversation.messages.length} messages • 
                            Updated {new Date(conversation.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {userCore.conversations.length > 10 && (
                    <p className="text-center text-sm text-gray-500">
                      ... and {userCore.conversations.length - 10} more conversations
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No conversations yet. Start chatting to build your memory!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Uploads Tab */}
        <TabsContent value="uploads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File Uploads</CardTitle>
              <CardDescription>
                Your uploaded images and documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Form */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-gray-400" />
                  <div>
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-500">Upload a file</span>
                      <Input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUploadFile(e.target.files?.[0] || null)}
                        accept="image/*,.pdf,.txt,.md,.json,.csv"
                      />
                    </Label>
                    <p className="text-xs text-gray-500">
                      Images, PDFs, text files up to 50MB
                    </p>
                  </div>
                  {uploadFile && (
                    <div className="mt-2">
                      <p className="text-sm">{uploadFile.name}</p>
                      <Button onClick={handleFileUpload} size="sm" className="mt-2">
                        Upload
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Uploaded Files */}
              {userCore?.uploads.length ? (
                <div className="space-y-2">
                  {userCore.uploads.slice(0, 10).map(upload => (
                    <div key={upload.id} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <p className="font-medium text-sm">{upload.filename}</p>
                        <p className="text-xs text-gray-500">
                          {upload.type} • {new Date(upload.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No uploads yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generations Tab */}
        <TabsContent value="generations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generated Content</CardTitle>
              <CardDescription>
                AI-generated documents, code, and analyses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userCore?.generations.length ? (
                <div className="space-y-3">
                  {userCore.generations.slice(0, 10).map(generation => (
                    <div key={generation.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{generation.title}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {generation.type}
                          </Badge>
                          <p className="text-xs text-gray-500 mt-1">
                            Generated {new Date(generation.generatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No generated content yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookmarks Tab */}
        <TabsContent value="bookmarks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bookmarks</CardTitle>
              <CardDescription>
                Saved links and content for quick access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Bookmark Form */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Add Bookmark</h4>
                <div className="grid grid-cols-1 gap-3">
                  <Input
                    placeholder="Bookmark title"
                    value={newBookmark.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBookmark(prev => ({ ...prev, title: e.target.value }))}
                  />
                  <Input
                    placeholder="URL"
                    value={newBookmark.url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBookmark(prev => ({ ...prev, url: e.target.value }))}
                  />
                  <Input
                    placeholder="Tags (comma separated)"
                    value={newBookmark.tags}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBookmark(prev => ({ ...prev, tags: e.target.value }))}
                  />
                  <Button onClick={handleAddBookmark} disabled={!newBookmark.title}>
                    <BookmarkPlus className="h-4 w-4 mr-2" />
                    Add Bookmark
                  </Button>
                </div>
              </div>

              {/* Bookmarks List */}
              {userCore?.bookmarks.length ? (
                <div className="space-y-2">
                  {userCore.bookmarks.map(bookmark => (
                    <div key={bookmark.id} className="border rounded-lg p-3">
                      <h4 className="font-medium">{bookmark.title}</h4>
                      {bookmark.url && (
                        <p className="text-sm text-blue-600 hover:underline cursor-pointer">
                          {bookmark.url}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {bookmark.tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No bookmarks yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ZED Preferences</CardTitle>
              <CardDescription>
                Customize your AI's behavior and appearance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <select
                    id="theme"
                    className="w-full p-2 border rounded"
                    value={preferences.theme || 'light'}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPreferences((prev: any) => ({ ...prev, theme: e.target.value }))}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="language">Language</Label>
                  <select
                    id="language"
                    className="w-full p-2 border rounded"
                    value={preferences.language || 'en'}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPreferences((prev: any) => ({ ...prev, language: e.target.value }))}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="responseStyle">Response Style</Label>
                  <select
                    id="responseStyle"
                    className="w-full p-2 border rounded"
                    value={preferences.responseStyle || 'concise'}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPreferences((prev: any) => ({ ...prev, responseStyle: e.target.value }))}
                  >
                    <option value="concise">Concise</option>
                    <option value="detailed">Detailed</option>
                    <option value="creative">Creative</option>
                  </select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="customPrompts">Custom System Prompt</Label>
                <Textarea
                  id="customPrompts"
                  placeholder="Add custom instructions for your ZED..."
                  value={preferences.customPrompts?.system || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPreferences((prev: any) => ({
                    ...prev,
                    customPrompts: { ...prev.customPrompts, system: e.target.value }
                  }))}
                  rows={4}
                />
              </div>

              <Button onClick={handleUpdatePreferences}>
                <Settings className="h-4 w-4 mr-2" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
