import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Zap } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/UseAuth";
import { apiRequest } from "@/lib/queryClient";

import ChatSidebarHeader from "./ChatSidebarHeader";
import ConversationList from "./ConversationList";
import ChatSidebarUserCard from "./ChatSidebarUserCard";

import type { Conversation } from "@shared/schema";

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

export default function ChatSidebar({
  conversations,
  onClose,
  isMobile = false,
}: ChatSidebarProps) {
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
        mode: "chat",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      window.history.pushState({}, "", `/chat/${data.id}`);
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

  async function handleDeleteConversation(id: string) {
    await deleteConversationMutation.mutateAsync(id);

    if (location.includes(id)) {
      window.history.pushState({}, "", "/chat");
    }
  }

  async function handleProfileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPicture(true);

    try {
      const formData = new FormData();
      formData.append("profilePicture", file);

      const response = await fetch("/api/auth/profile-picture", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been successfully updated!",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error) {
      toast({
        title: "Upload failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload profile picture. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPicture(false);
      e.target.value = "";
    }
  }

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
          +
        </Button>

        <div className="w-full flex justify-center">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        isMobile ? "w-full h-screen-mobile" : "w-80 h-full"
      } flex flex-col relative zed-glass ${
        isMobile ? "" : "border-r"
      } border-purple-500/30 backdrop-blur-xl`}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-4 w-20 h-20 bg-purple-600/10 rounded-full blur-2xl zed-float" />
        <div
          className="absolute bottom-20 right-4 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl zed-float"
          style={{ animationDelay: "3s" }}
        />
      </div>

      <ChatSidebarHeader
        isMobile={isMobile}
        isCreating={createConversationMutation.isPending}
        onCreateConversation={() => createConversationMutation.mutate()}
        onClose={onClose}
        onCollapse={() => setIsCollapsed(true)}
      />

      <div className="flex-1 px-4 overflow-y-auto">
        <ConversationList
          conversations={conversations}
          currentPath={location}
          onSelect={(id) => window.history.pushState({}, "", `/chat/${id}`)}
          onDelete={handleDeleteConversation}
        />
      </div>

      <ChatSidebarUserCard
        user={user}
        isUploadingPicture={isUploadingPicture}
        onUpload={handleProfileUpload}
      />

      <div className="p-4 border-t border-white/10 relative z-10">
        <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
          <Zap size={12} className="text-purple-400" />
          <span>Powered by OpenAI</span>
          <div className="w-1 h-1 bg-purple-400 rounded-full" />
          <span>Local Auth</span>
        </div>
      </div>
    </div>
  );
}