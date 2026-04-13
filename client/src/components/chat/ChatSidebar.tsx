import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, MessageSquare, Plus, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/UseAuth";
import SettingsModal from "@/components/settings/SettingsModal";

import ChatSidebarHeader from "./ChatSidebarHeader";
import ConversationList from "./ConversationList";
import ChatSidebarUserCard from "./ChatSidebarUserCard";

import type { Conversation } from "@shared/schema";
import type { FilingProject } from "@/pages/chat";

interface ChatSidebarProps {
  conversations: Conversation[];
  projects: FilingProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
  onAssignProject: (conversationId: string, projectId: string | null) => void;
  onClose?: () => void;
  isMobile?: boolean;
  onMenuClick?: () => void;
}

interface LocalUser {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  isAdmin?: boolean;
}

export default function ChatSidebar({
  conversations,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onAssignProject,
  onClose,
  isMobile = false,
}: ChatSidebarProps) {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth() as { user?: LocalUser };

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "New Chat", mode: "chat" }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: async (data: any) => {
      const verifyRes = await fetch(`/api/conversations/${data.id}`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!verifyRes.ok) {
        throw new Error(`Conversation verification failed (${verifyRes.status})`);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (selectedProjectId) {
        void onAssignProject(data.id, selectedProjectId);
      }
      navigate(`/chat/${data.id}`);
      if (isMobile && onClose) onClose();
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  async function handleDeleteConversation(id: string) {
    await deleteConversationMutation.mutateAsync(id);
    if (location.includes(id)) {
      navigate("/chat");
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
      </div>
    );
  }

  return (
      <div
      className={`${
        isMobile ? "w-full h-screen" : "w-72 h-full"
      } flex flex-col relative zed-glass ${
        isMobile ? "" : "border-r"
      } border-purple-500/30 backdrop-blur-xl`}
    >
      {/* Ambient orbs */}
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
        isAdmin={!!user?.isAdmin}
        onOpenAdmin={() => navigate("/admin")}
      />

      <div className="flex-1 overflow-y-auto px-3">
        <div className="space-y-2 border-b border-white/10 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FolderKanban className="h-3.5 w-3.5 text-purple-400" />
              Projects
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 zed-button" onClick={onCreateProject}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <button
            onClick={() => onSelectProject(null)}
            className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
              selectedProjectId === null ? "zed-glass border border-purple-500/30 text-white" : "text-muted-foreground hover:bg-white/5"
            }`}
          >
            Inbox
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                selectedProjectId === project.id ? "zed-glass border border-purple-500/30 text-white" : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
                <span className="text-[11px] text-muted-foreground">({project.conversationIds.length})</span>
              </span>
            </button>
          ))}
        </div>
        <ConversationList
          conversations={conversations}
          projects={projects}
          currentPath={location}
          selectedProjectId={selectedProjectId}
          onSelect={(id) => {
            navigate(`/chat/${id}`);
            if (isMobile && onClose) onClose();
          }}
          onDelete={handleDeleteConversation}
          onAssignProject={onAssignProject}
        />
      </div>

      <ChatSidebarUserCard user={user} isUploadingPicture={false} onUpload={() => {}} />

      {/* Bottom controls */}
      <div className="relative z-10 space-y-1 border-t border-white/10 p-3">
        <div className="flex items-center justify-center space-x-2 pt-1 text-[11px] text-muted-foreground">
          <Zap size={12} className="text-purple-400" />
          <span>Qwen2.5 via Ollama</span>
          <div className="w-1 h-1 bg-purple-400 rounded-full" />
          <span>Local</span>
        </div>
      </div>
    </div>
  );
}
