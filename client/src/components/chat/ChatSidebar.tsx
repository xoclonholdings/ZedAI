import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/UseAuth";

import ChatSidebarHeader from "./ChatSidebarHeader";
import ConversationList from "./ConversationList";
import ChatSidebarUserCard from "./ChatSidebarUserCard";
import ChatRuntimeFooter from "./ChatRuntimeFooter";

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
  displayName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  personalization?: {
    compactMessages?: boolean;
    fontSize?: string;
    showTimestamps?: boolean;
  };
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
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${body ? ` — ${body.slice(0, 160)}` : ""}`);
      }
      // Force /api/me to refetch so the new profileImageUrl flows
      // through useAuth and the avatar updates immediately.
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (err: any) {
      console.error("[avatar] upload failed:", err);
      window.alert(err?.message || "Avatar upload failed");
    } finally {
      setIsUploadingPicture(false);
      // Reset the input so re-selecting the same file still triggers onChange
      e.target.value = "";
    }
  }

  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout } = useAuth() as { user?: LocalUser; logout: () => Promise<void> };
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const compact = !!user?.personalization?.compactMessages;
  const fontSize = (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const headingClass = fontSize === "small" ? "text-xs" : fontSize === "large" ? "text-base" : "text-sm";

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
      if (data?.id) {
        window.history.pushState({}, "", `/chat/${data.id}`);
      }
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

  async function handleRenameConversation(id: string, currentTitle: string) {
    const title = window.prompt("Rename chat", currentTitle);
    if (!title?.trim() || title.trim() === currentTitle) return;
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: title.trim() }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id] });
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      queryClient.clear();
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
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

      <div className={`flex-1 px-4 overflow-y-auto ${compact ? "text-sm" : ""}`}>
        <div className={`${compact ? "space-y-2 py-2" : "space-y-3 py-3"}`}>
          <div className="flex items-center justify-between">
            <div className={`${headingClass} font-medium text-foreground`}>Projects</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateProject()}
              className="h-8 w-8 rounded-xl zed-button p-0 text-muted-foreground hover:text-foreground"
            >
              +
            </Button>
          </div>

          <div className={`${compact ? "space-y-1.5" : "space-y-2"}`}>
            <button
              onClick={() => onSelectProject(null)}
              className={`w-full rounded-xl border px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-left transition-all ${
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
                className={`w-full rounded-xl border px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-left transition-all ${
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
            if (id) {
              window.history.pushState({}, "", `/chat/${id}`);
            }
            if (isMobile && onClose) onClose();
          }}
          onDelete={handleDeleteConversation}
          onAssignProject={onAssignProject}
          onRename={handleRenameConversation}
        />
      </div>

      <ChatSidebarUserCard
        user={user}
        isUploadingPicture={isUploadingPicture}
        onUpload={handleAvatarUpload}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Bottom controls */}
      <div className="p-3 border-t border-white/10 relative z-10 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin")}
          className="w-full justify-start zed-button text-muted-foreground hover:text-purple-400"
        >
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Admin Panel
        </Button>

        <ChatRuntimeFooter />
      </div>
    </div>
  );
}
