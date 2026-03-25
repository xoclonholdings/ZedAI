import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  User, 
  X, 
  Sparkles,
  Zap,
  Camera,
  Upload
} from "lucide-react";
import zLogoPath from "@assets/IMG_2227_1753477194826.png";
import { useLocation, Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";

import LogoutButton from "@/components/auth/LogoutButton";
import SettingsModal from "@/components/settings/SettingsModal";

interface ChatSidebarProps {
  conversations: Conversation[];
  onClose?: () => void;
  isMobile?: boolean;
}

interface LocalUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

export default function ChatSidebar({ conversations, onClose, isMobile = false }: ChatSidebarProps) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
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
      <div className="p-6 border-b border-white/10 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div>
              <h2 className="text-xl font-bold flex items-center space-x-2">
                <img src={zLogoPath} alt="Z" className="w-5 h-5" />
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
              </h2>
              <p className="text-xs text-muted-foreground">Enhanced AI Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <LogoutButton />
            {isMobile ? (
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="w-8 h-8 zed-button rounded-xl p-0 text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </Button>
            ) : (
              <Button
                onClick={() => setIsCollapsed(true)}
                variant="ghost"
                size="sm"
                className="w-8 h-8 zed-button rounded-xl p-0 text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </Button>
            )}
          </div>
        </div>



        {/* New Conversation Button */}
        <Button
          onClick={() => createConversationMutation.mutate()}
          disabled={createConversationMutation.isPending}
          className="w-full zed-gradient hover:zed-gradient-hover rounded-xl p-4 text-white font-medium transition-all duration-300"
        >
          <div className="flex items-center justify-center space-x-2">
            <Plus size={18} />
            <span>New Conversation</span>
            <Sparkles size={14} className="text-cyan-300" />
          </div>
        </Button>

        {/* Navigation */}
        <div className="mt-4 space-y-2">
          <SettingsModal />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 px-4 overflow-y-auto">
        <div className="space-y-2 py-4">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Start a new chat to begin</p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const isActive = location === `/chat/${conversation.id}` || location === `/chat/${conversation.id}/`;
              const date = conversation.updatedAt || conversation.createdAt;
              
              return (
                <div
                  key={conversation.id}
                  className={`
                    group relative p-3 rounded-xl cursor-pointer transition-all zed-button
                    ${isActive 
                      ? 'zed-glass border-purple-500/50 shadow-lg shadow-purple-500/20' 
                      : 'hover:bg-white/5'
                    }
                  `}
                  onClick={() => window.history.pushState({}, '', `/chat/${conversation.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground truncate mb-1">
                        {conversation.title || 'New Conversation'}
                      </h3>
                      {conversation.preview && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {conversation.preview}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(date)}
                        </span>
                        {conversation.mode && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
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
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20 h-auto p-1 ml-2 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center space-x-3">
          <div className="relative group">
            <div 
              className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
              onClick={() => document.getElementById('profile-upload')?.click()}
            >
              {user?.profileImageUrl ? (
                <img 
                  src={user.profileImageUrl} 
                  alt={user.firstName || "User"} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={20} className="text-white" />
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
                      // Refresh user data
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
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center border-2 border-black group-hover:bg-purple-400 transition-colors">
              {isUploadingPicture ? (
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={12} className="text-white" />
              )}
            </div>
            {/* Hover tooltip */}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              Click to upload photo
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.firstName || user?.email || "ZED Admin"}
            </p>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 relative z-10">
        <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
          <Zap size={12} className="text-purple-400" />
          <span>Powered by OpenAI</span>
          <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
          <span>Local Auth</span>
        </div>
      </div>
    </div>
  );
}