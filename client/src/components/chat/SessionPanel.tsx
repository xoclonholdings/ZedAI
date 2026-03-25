import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import SatelliteConnection from "../satellite/SatelliteConnection";
import PhoneLink from "../phone/PhoneLink";
import { 
  X, 
  FileText, 
  Code, 
  Share2, 
  ExternalLink,
  Clock,
  HardDrive,
  MessageSquare,
  File,
  Zap
} from "lucide-react";
import type { Conversation, File as FileType, Session } from "@shared/schema";

interface SessionPanelProps {
  conversation?: Conversation;
  files: FileType[];
  session?: Session;
}

export default function SessionPanel({ conversation, files, session }: SessionPanelProps) {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return "📷";
    if (mimeType.includes('csv') || mimeType.includes('excel')) return "📊";
    if (mimeType === 'application/pdf') return "📄";
    if (mimeType === 'text/plain') return "📝";
    return "📁";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600";
      case "processing": return "text-yellow-600";
      case "error": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  // Session statistics
  const messagesUsed = session?.messagesUsed || 0;
  const storageUsed = 0; // GB - calculated from uploaded files

  return (
    <div className="w-96 zed-sidebar flex flex-col h-full relative">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-4 w-20 h-20 bg-cyan-600/5 rounded-full blur-2xl zed-float" />
        <div className="absolute bottom-20 left-4 w-16 h-16 bg-purple-500/5 rounded-full blur-xl zed-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Panel Header */}
      <div className="p-6 border-b border-white/10 relative z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Session Control
          </h3>
        </div>
      </div>

      {/* Connectivity Panel */}
      <div className="p-4 border-b border-white/10 relative z-10 space-y-4">
        <SatelliteConnection />
        <PhoneLink />
      </div>

      {/* Session Stats */}
      <div className="p-4 border-b border-white/10 relative z-10">
        <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center">
          <MessageSquare size={16} className="mr-2 text-purple-400" />
          Session Analytics
        </h4>
        <div className="space-y-4">
          <Card className="zed-glass p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">AI Model</span>
              <Badge className="bg-purple-600/20 text-purple-400 border-purple-400/30">
                {conversation?.model || "GPT-4o"}
              </Badge>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground flex items-center">
                <Clock size={12} className="mr-1" />
                Session Time
              </span>
              <span className="text-sm font-medium text-foreground">
                {session?.duration ? formatDuration(session.duration) : "0m"}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground flex items-center">
                <FileText size={12} className="mr-1" />
                Files Processed
              </span>
              <span className="text-sm font-medium text-foreground">
                {files.length} files
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center">
                <HardDrive size={12} className="mr-1" />
                Memory Usage
              </span>
              <span className="text-sm font-medium text-foreground">
                {session?.memoryUsage ? `${session.memoryUsage} MB` : "0 MB"}
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Files in Session */}
      <div className="flex-1 p-4 overflow-y-auto relative z-10">
        <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center">
          <File size={16} className="mr-2 text-cyan-400" />
          Data Storage
        </h4>
        {files.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 zed-avatar rounded-2xl flex items-center justify-center mx-auto mb-4">
              <File size={24} className="text-white" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">No files uploaded</p>
            <p className="text-xs text-muted-foreground/60">Drag & drop files to analyze</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <Card key={file.id} className="zed-message p-3 hover:zed-glow transition-all duration-300">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-8 h-8 zed-avatar rounded-xl flex items-center justify-center">
                    <span className="text-sm">{getFileIcon(file.mimeType)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.originalName}
                    </p>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                      <Badge 
                        className={`text-xs ${
                          file.status === 'completed' ? 'bg-green-600/20 text-green-400 border-green-400/30' :
                          file.status === 'processing' ? 'bg-yellow-600/20 text-yellow-400 border-yellow-400/30' :
                          'bg-red-600/20 text-red-400 border-red-400/30'
                        }`}
                      >
                        {file.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                {file.status === "completed" && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full zed-button rounded-xl text-xs h-8"
                  >
                    <ExternalLink size={12} className="mr-1" />
                    View Analysis
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-white/10 relative z-10">
        <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center">
          <Zap size={16} className="mr-2 text-yellow-400" />
          Quick Actions
        </h4>
        <div className="space-y-3">
          <Button 
            variant="ghost" 
            className="w-full zed-button rounded-xl justify-start hover:zed-glow transition-all duration-300"
          >
            <FileText size={16} className="mr-3 text-cyan-400" />
            <div className="text-left">
              <div className="text-sm font-medium text-foreground">Generate Report</div>
              <div className="text-xs text-muted-foreground">Export analysis results</div>
            </div>
          </Button>

          <Button 
            variant="ghost" 
            className="w-full zed-button rounded-xl justify-start hover:zed-glow transition-all duration-300"
          >
            <Code size={16} className="mr-3 text-purple-400" />
            <div className="text-left">
              <div className="text-sm font-medium text-foreground">Export Code</div>
              <div className="text-xs text-muted-foreground">Download generated scripts</div>
            </div>
          </Button>

          <Button 
            variant="ghost" 
            className="w-full zed-button rounded-xl justify-start hover:zed-glow transition-all duration-300"
          >
            <Share2 size={16} className="mr-3 text-pink-400" />
            <div className="text-left">
              <div className="text-sm font-medium text-foreground">Share Session</div>
              <div className="text-xs text-muted-foreground">Team collaboration</div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
