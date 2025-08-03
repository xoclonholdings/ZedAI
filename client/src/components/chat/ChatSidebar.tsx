import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

import {
  MessageSquare,
  Trash2,
  User,
  X,
  Zap,
  Camera,
  Bell,
  Shield,
  Database,
  Bot,
  LogOut,
  Settings
} from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuthProvider.tsx";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";

interface ChatSidebarProps {
  conversations: Conversation[];
  onClose?: () => void;
  isMobile?: boolean;
}

export default function ChatSidebar({ conversations = [], onClose, isMobile = false }: ChatSidebarProps) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [currentMode, setCurrentMode] = useState<"chat" | "agent">("chat");
  const [notifications, setNotifications] = useState(true);
  const [dataSharing, setDataSharing] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const { user, logout } = useAuth();
  const { toast } = useToast();

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

  return (
    <div className={`${isMobile ? 'w-full h-screen-mobile' : 'w-80 h-full'} flex flex-col relative zed-glass ${isMobile ? '' : 'border-r'} border-purple-500/30 backdrop-blur-xl`}>
      {/* Cyberpunk Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-4 w-20 h-20 bg-purple-600/10 rounded-full blur-2xl zed-float" />
        <div className="absolute bottom-20 right-4 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl zed-float" />
      </div>

      {/* Header */}
      <div className="p-2 sm:p-3 border-b border-white/10 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {/* User Profile Photo Button - Replaced ZED Logo */}
            <div className="relative group">
              <div
                className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                onClick={() => document.getElementById('profile-upload')?.click()}
              >
                {user ? (
                  <img
                    src={`/api/auth/profile-picture/${user.id}`}
                    alt={user.name || "User"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to default user icon if image fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <User size={16} className={`text-white ${user ? 'hidden' : ''}`} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center border border-black group-hover:bg-purple-400 transition-colors">
                {isUploadingPicture ? (
                  <div className="w-1.5 h-1.5 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera size={6} className="text-white" />
                )}
              </div>
              {/* Hover tooltip */}
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Click to upload photo
              </div>
              {/* Hidden file input */}
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploadingPicture}
                title="Upload profile picture"
                placeholder="Choose a profile picture"
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
                        await response.json();
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
            </div>

            <div className="text-left">
              <h1 className="text-sm font-bold">
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {user?.name || user?.email || "User"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="w-8 h-8 zed-button rounded-lg p-0 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Chat/Agent Mode Toggle - Compact with cyberpunk gradient */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-pink-500/10 border border-purple-500/30 mt-2">
          <div className="flex items-center space-x-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-r ${currentMode === 'chat' ? 'from-cyan-500 to-blue-500' : 'from-purple-500 to-pink-500'}`}>
              {currentMode === 'chat' ? <MessageSquare size={12} className="text-white" /> : <Bot size={12} className="text-white" />}
            </div>
            <div>
              <div className="text-xs font-medium bg-gradient-to-r from-purple-300 to-cyan-300 bg-clip-text text-transparent">
                {currentMode === 'chat' ? 'Chat' : 'Agent'} Mode
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMode(currentMode === 'chat' ? 'agent' : 'chat')}
            className="h-6 w-12 p-0 rounded-full bg-gradient-to-r from-purple-500/20 to-cyan-500/20 relative border border-purple-400/30 hover:border-purple-300/50"
          >
            <div className={`absolute w-4 h-4 bg-gradient-to-r from-white to-purple-100 rounded-full transition-transform shadow-lg ${currentMode === 'agent' ? 'translate-x-2' : '-translate-x-2'}`} />
          </Button>
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
            {Array.isArray(conversations)
              ? conversations.filter(conversation => !conversation.title?.toLowerCase().includes('test')).length
              : 0}
          </Badge>
        </div>

        <div className="space-y-1 pb-2">
          {(() => {
            const filteredConversations = Array.isArray(conversations)
              ? conversations.filter(conversation => !conversation.title?.toLowerCase().includes('test'))
              : [];

            if (filteredConversations.length === 0) {
              return (
                <div className="text-center py-4 text-muted-foreground">
                  <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Your conversations will appear here</p>
                </div>
              );
            }

            return filteredConversations.map((conversation) => {
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
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${conversation.mode === 'agent'
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
            });
          })()}
        </div>
      </div>

      {/* Quick Settings Row - Moved below Recent Chats */}
      <div className="px-2 pb-2">
        <div className="mt-2 space-y-1">
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

          {/* Advanced Settings Button */}
          <div className="flex justify-center mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs rounded-lg transition-colors bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-purple-500/30 hover:border-purple-400/50 text-purple-300 hover:text-purple-200"
              title="Advanced Settings"
            >
              <Settings size={12} className="mr-2" />
              Advanced Settings
            </Button>
          </div>

          {/* Powered by Zebulon */}
          <div className="flex items-center justify-center mt-2 p-2">
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <Zap size={10} className="text-purple-400" />
              <span>Powered by Zebulon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-1 border-t border-white/10 relative z-10">
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await logout();
                toast({
                  title: "Logged out successfully",
                  description: "You have been logged out of your account.",
                });
                // Redirect to login or home page
                window.location.href = '/';
              } catch (error) {
                console.error('Logout error:', error);
                toast({
                  title: "Logout failed",
                  description: "There was an error logging out. Please try again.",
                  variant: "destructive",
                });
              }
            }}
            className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
          >
            <LogOut size={12} />
            <span>Logout</span>
          </Button>
        </div>
      </div>
    </div>
  );
}