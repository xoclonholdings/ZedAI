import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  User, 
  X, 
  Sparkles,
  Zap,
  Camera,
  Upload,
  Settings,
  Bell,
  Shield,
  Palette,
  Database,
  Bot,
  Users,
  Eye,
  Volume2,
  Moon,
  Sun,
  Globe
} from "lucide-react";
const zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";
import { useLocation, Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";

import LogoutButton from "@/components/auth/LogoutButton";

interface ChatSidebarProps {
  conversations: Conversation[];
  onClose?: () => void;
  isMobile?: boolean;
  onMenuClick?: () => void;
}

interface LocalUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

export default function ChatSidebar({ conversations = [], onClose, isMobile = false, onMenuClick }: ChatSidebarProps) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentMode, setCurrentMode] = useState<"chat" | "agent">("chat");
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [dataSharing, setDataSharing] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const { user } = useAuth() as { user?: LocalUser };
  const { toast } = useToast();

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/conversations", "POST", { 
        title: "New Conversation",
        mode: "chat"
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      window.history.pushState({}, '', `/chat/${data.id}`);
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/conversations/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const formatDate = (dateInput: string | Date | null): string => {
    if (!dateInput) return "";
    
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return "Today";
    } else if (diffInHours < 168) {
      return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
    } else {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    await deleteConversationMutation.mutateAsync(id);
    
    if (location.includes(id)) {
      window.history.pushState({}, '', '/chat');
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-16 flex flex-col items-center py-4 space-y-4 zed-glass border-r border-white/10 backdrop-blur-xl">
        <Button
          onClick={() => setIsCollapsed(false)}
          variant="ghost"
          size="sm"
          className="w-10 h-10 zed-button rounded-xl"
        >
          <MessageSquare size={20} />
        </Button>
        
        <Button 
          onClick={() => createConversationMutation.mutate()}
          className="w-10 h-10 zed-gradient rounded-xl zed-button p-0"
          disabled={createConversationMutation.isPending}
        >
          <Plus size={20} />
        </Button>

        {/* Collapsed Status */}
        <div className="w-full">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'w-full h-screen-mobile' : 'w-80 h-full'} flex flex-col relative zed-glass ${isMobile ? '' : 'border-r'} border-purple-500/30 backdrop-blur-xl`}>
      {/* Cyberpunk Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-4 w-20 h-20 bg-purple-600/10 rounded-full blur-2xl zed-float" />
        <div className="absolute bottom-20 right-4 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl zed-float" style={{ animationDelay: '3s' }} />
      </div>

      {/* Header */}
      <div className="p-2 sm:p-3 border-b border-white/10 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {/* Logo Button - Compact and Clickable */}
            <Button
              variant="ghost"
              size="sm"
              className="w-10 h-10 p-1.5 rounded-lg hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-blue-500/20 transition-all duration-300 hover:scale-105 border border-transparent hover:border-purple-500/50"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('ZED logo button clicked!', { isMobile, onClose, onMenuClick });
                if (isMobile && onClose) {
                  onClose();
                } else if (onMenuClick) {
                  onMenuClick();
                }
              }}
            >
              <img src={zLogoPath} alt="Z" className="w-6 h-6" />
            </Button>
            
            <div className="text-left">
              <h1 className="text-sm font-bold">
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">AI Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <LogoutButton />
            {isMobile ? (
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="w-8 h-8 zed-button rounded-lg p-0 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </Button>
            ) : (
              <Button
                onClick={() => setIsCollapsed(true)}
                variant="ghost"
                size="sm"
                className="w-8 h-8 zed-button rounded-lg p-0 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </Button>
            )}
          </div>
        </div>

        {/* Compact New Chat Button */}
        <Button
          onClick={() => createConversationMutation.mutate()}
          disabled={createConversationMutation.isPending}
          className="w-full h-9 zed-gradient rounded-lg text-white font-medium transition-all duration-300 text-sm"
        >
          <div className="flex items-center justify-center space-x-1.5">
            <Plus size={14} />
            <span>New Chat</span>
            <Sparkles size={12} className="text-cyan-300" />
          </div>
        </Button>

        {/* Settings & Controls */}
        <div className="mt-2 space-y-1">
          {/* Chat/Agent Mode Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center space-x-2">
              <div className={`w-4 h-4 rounded flex items-center justify-center ${currentMode === 'chat' ? 'bg-cyan-500' : 'bg-purple-500'}`}>
                {currentMode === 'chat' ? <MessageSquare size={10} className="text-white" /> : <Bot size={10} className="text-white" />}
              </div>
              <span className="text-xs font-medium">{currentMode === 'chat' ? 'Chat' : 'Agent'} Mode</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMode(currentMode === 'chat' ? 'agent' : 'chat')}
              className="h-6 w-12 p-0 rounded-full bg-white/10 relative"
            >
              <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${currentMode === 'agent' ? 'translate-x-2' : '-translate-x-2'}`} />
            </Button>
          </div>

          {/* Quick Settings Row */}
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotifications(!notifications)}
              className={`flex-1 h-8 text-xs rounded-lg transition-colors ${notifications ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-muted-foreground'}`}
            >
              <Bell size={12} className="mr-1" />
              Alerts
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDataSharing(!dataSharing)}
              className={`flex-1 h-8 text-xs rounded-lg transition-colors ${dataSharing ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-muted-foreground'}`}
            >
              <Shield size={12} className="mr-1" />
              Privacy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAnalytics(!analytics)}
              className={`flex-1 h-8 text-xs rounded-lg transition-colors ${analytics ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-muted-foreground'}`}
            >
              <Database size={12} className="mr-1" />
              Data
            </Button>
          </div>
        </div>
      </div>

      {/* Chat History Section */}
      <div className="flex-1 px-2 overflow-y-auto">
        {/* Section Header */}
        <div className="flex items-center justify-between py-2 px-1">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <h3 className="text-xs font-semibold text-foreground">Recent Chats</h3>
          </div>
          <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 border-purple-500/30">
            {(conversations && conversations.length) || 0}
          </Badge>
        </div>

        <div className="space-y-1 pb-2">
          {Array.isArray(conversations) && conversations.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">Your conversations will appear here</p>
            </div>
          ) : (
            Array.isArray(conversations) ? conversations.map((conversation) => {
              const isActive = location === `/chat/${conversation.id}` || location === `/chat/${conversation.id}/`;
              const date = conversation.updatedAt || conversation.createdAt;
              
              return (
                <div
                  key={conversation.id}
                  className={`
                    group relative p-2 rounded-lg cursor-pointer transition-all zed-button
                    ${isActive 
                      ? 'zed-glass border-purple-500/50 shadow-md shadow-purple-500/20' 
                      : 'hover:bg-white/5'
                    }
                  `}
                  onClick={() => window.history.pushState({}, '', `/chat/${conversation.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-medium text-foreground truncate mb-1">
                        {conversation.title || 'New Conversation'}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(date)}
                        </span>
                        {conversation.mode && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            conversation.mode === 'agent' 
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-cyan-500/20 text-cyan-400'
                          }`}>
                            {conversation.mode}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteConversation(e, conversation.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20 h-auto p-1 ml-1 rounded"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              );
            }) : null
          )}
        </div>
      </div>

      {/* Compact User Profile */}
      <div className="p-1 border-t border-white/10">
        <div className="flex items-center space-x-2">
          <div className="relative group">
            <div 
              className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
              onClick={() => document.getElementById('profile-upload')?.click()}
            >
              {user?.profileImageUrl ? (
                <img 
                  src={user.profileImageUrl} 
                  alt={user.firstName || "User"} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={12} className="text-white" />
              )}
            </div>
            <input
              id="profile-upload"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploadingPicture}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setIsUploadingPicture(true);
                  try {
                    const formData = new FormData();
                    formData.append('profilePicture', file);
                    
                    const response = await fetch('/api/auth/profile-picture', {
                      method: 'POST',
                      body: formData,
                    });
                    
                    if (response.ok) {
                      const result = await response.json();
                      toast({
                        title: "Profile picture updated",
                        description: "Your profile picture has been successfully updated!",
                      });
                      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                    } else {
                      const error = await response.json();
                      throw new Error(error.error || 'Upload failed');
                    }
                  } catch (error) {
                    console.error('Upload error:', error);
                    toast({
                      title: "Upload failed",
                      description: error instanceof Error ? error.message : "Failed to upload profile picture. Please try again.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsUploadingPicture(false);
                    // Reset the input so the same file can be selected again
                    e.target.value = '';
                  }
                }
              }}
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center border border-black group-hover:bg-purple-400 transition-colors">
              {isUploadingPicture ? (
                <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={8} className="text-white" />
              )}
            </div>
            {/* Hover tooltip */}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              Click to upload photo
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {user?.firstName || user?.email || "ZED Admin"}
            </p>
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-1 border-t border-white/10 relative z-10">
        <div className="flex items-center justify-center space-x-1 text-xs text-muted-foreground">
          <Zap size={10} className="text-purple-400" />
          <span className="text-xs">Powered by OpenAI</span>
          <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
          <span className="text-xs">Local Auth</span>
        </div>
      </div>
    </div>
  );
}