import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  Brain, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  Settings,
  FolderOpen,
  Sparkles
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface MemoryStats {
  adminPersonality: boolean;
  standardPersonality: boolean;
  contextualMemoryCount: number;
  interactionHistoryCount: number;
  knowledgeDomainCount: number;
  lastImportDate?: string;
}

export default function MemoryManager() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [folderPath, setFolderPath] = useState("");
  const [personalityMode, setPersonalityMode] = useState<'enhanced' | 'standard'>('standard');

  // Load stats on component mount
  useState(() => {
    loadStats();
  });

  const loadStats = async () => {
    try {
      const response = await apiRequest('/api/memory/stats', 'GET');
      setStats(response);
    } catch (error) {
      console.error('Failed to load memory stats:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('export', file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/memory/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.ok) {
        const result = await response.json();
        setMessage({ type: 'success', text: result.message });
        await loadStats();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Upload failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Upload failed: ' + (error as Error).message });
    } finally {
      setUploading(false);
      setProgress(0);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleFolderImport = async () => {
    if (!folderPath.trim()) {
      setMessage({ type: 'error', text: 'Please enter a folder path' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const response = await apiRequest('/api/memory/import-folder', 'POST', {
        folderPath: folderPath.trim()
      });

      setMessage({ type: 'success', text: response.message });
      await loadStats();
    } catch (error) {
      setMessage({ type: 'error', text: 'Folder import failed: ' + (error as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const togglePersonality = async (mode: 'enhanced' | 'standard') => {
    try {
      await apiRequest('/api/memory/toggle-personality', 'POST', {
        personalityMode: mode
      });
      setPersonalityMode(mode);
      setMessage({ type: 'success', text: `Switched to ${mode} personality mode` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to toggle personality: ' + (error as Error).message });
    }
  };

  const deleteAdminPersonality = async () => {
    if (!confirm('Are you sure you want to delete the admin personality data? This action cannot be undone.')) {
      return;
    }

    try {
      await apiRequest('/api/memory/admin-personality', 'DELETE');
      setMessage({ type: 'success', text: 'Admin personality data deleted successfully' });
      await loadStats();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete personality data: ' + (error as Error).message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
          ZED Memory Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Import OpenAI assistant memory and manage ZED's personality
        </p>
      </div>

      {/* Current Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>Memory Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{stats?.contextualMemoryCount || 0}</div>
              <div className="text-sm text-muted-foreground">Contextual Memories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{stats?.interactionHistoryCount || 0}</div>
              <div className="text-sm text-muted-foreground">Interactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-400">{stats?.knowledgeDomainCount || 0}</div>
              <div className="text-sm text-muted-foreground">Knowledge Domains</div>
            </div>
            <div className="text-center">
              <Badge variant={stats?.adminPersonality ? "default" : "secondary"}>
                {stats?.adminPersonality ? "Enhanced" : "Standard"}
              </Badge>
              <div className="text-sm text-muted-foreground mt-1">Personality</div>
            </div>
          </div>
          
          {stats?.lastImportDate && (
            <div className="mt-4 text-sm text-muted-foreground">
              Last import: {new Date(stats.lastImportDate).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personality Mode Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Personality Mode</span>
          </CardTitle>
          <CardDescription>
            Toggle between enhanced (admin) and standard personality modes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button
              variant={personalityMode === 'standard' ? 'default' : 'outline'}
              onClick={() => togglePersonality('standard')}
              className="flex-1"
            >
              Standard Mode
            </Button>
            <Button
              variant={personalityMode === 'enhanced' ? 'default' : 'outline'}
              onClick={() => togglePersonality('enhanced')}
              disabled={!stats?.adminPersonality}
              className="flex-1"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Enhanced Mode
              {!stats?.adminPersonality && (
                <span className="ml-2 text-xs">(Import Required)</span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Import OpenAI Export</span>
          </CardTitle>
          <CardDescription>
            Upload your OpenAI assistant memory export (ZIP file)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="export-file">Select ZIP File</Label>
              <Input
                id="export-file"
                type="file"
                accept=".zip"
                onChange={handleFileUpload}
                disabled={uploading}
                className="mt-1"
              />
            </div>
            
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading and processing...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Folder Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FolderOpen className="w-5 h-5" />
            <span>Import from Folder</span>
          </CardTitle>
          <CardDescription>
            Import from an extracted folder path on the server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folder-path">Folder Path</Label>
              <Input
                id="folder-path"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="/path/to/openai/export/folder"
                disabled={uploading}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={handleFolderImport}
              disabled={uploading || !folderPath.trim()}
              className="w-full"
            >
              Import from Folder
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Management Actions */}
      {stats?.adminPersonality && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Memory Management</span>
            </CardTitle>
            <CardDescription>
              Manage imported personality data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={deleteAdminPersonality}
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Admin Personality Data
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>1. Export from OpenAI:</strong> Go to your OpenAI account settings and export your data.
            </p>
            <p>
              <strong>2. Upload ZIP:</strong> Upload the exported ZIP file using the form above.
            </p>
            <p>
              <strong>3. Enhanced Mode:</strong> Once imported, you can switch to enhanced mode for admin users.
            </p>
            <p>
              <strong>4. Standard Users:</strong> Regular users will always use the standard personality mode.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
