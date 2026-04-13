import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, MessageSquare, Zap } from "lucide-react";

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
  onCreateProject: () => Promise<void> | void;
  onAssignProject: (conversationId: string, projectId: string | null) => Promise<void> | void;
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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      window.history.pushState({}, "", `/chat/${data.id}`);
      if (isMobile && onClose) onClose();
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
      window.history.pushState({}, "", "/chat");
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
        isMobile ? "w-full h-screen" : "w-80 h-full"
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
      />

      <div className="flex-1 px-4 overflow-y-auto">
        <div className="space-y-3 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Projects</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateProject()}
              className="h-8 w-8 rounded-xl zed-button p-0 text-muted-foreground hover:text-foreground"
            >
              +
            </Button>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => onSelectProject(null)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                selectedProjectId === null
                  ? "border-cyan-400/40 bg-white/10 text-white"
                  : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              Inbox
            </button>

            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                  selectedProjectId === project.id
                    ? "border-cyan-400/40 bg-white/10 text-white"
                    : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {project.name}
              </button>
            ))}
          </div>
        </div>

        <ConversationList
          conversations={conversations}
          projects={projects}
          currentPath={location}
          selectedProjectId={selectedProjectId}
          onSelect={(id) => {
            window.history.pushState({}, "", `/chat/${id}`);
            if (isMobile && onClose) onClose();
          }}
          onDelete={handleDeleteConversation}
          onAssignProject={onAssignProject}
        />
      </div>

      <ChatSidebarUserCard user={user} isUploadingPicture={false} onUpload={() => {}} />

      {/* Bottom controls */}
      <div className="p-3 border-t border-white/10 relative z-10 space-y-1">
        <SettingsModal />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin")}
          className="w-full justify-start zed-button text-muted-foreground hover:text-purple-400"
        >
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Admin Panel
        </Button>

        <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground pt-1">
          <Zap size={12} className="text-purple-400" />
          <span>Qwen2.5 via Ollama</span>
          <div className="w-1 h-1 bg-purple-400 rounded-full" />
          <span>Local</span>
        </div>
      </div>
    </div>
  );
}
