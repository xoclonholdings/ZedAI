import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  ChevronDown,
  Clock,
  FolderKanban,
  GraduationCap,
  Inbox,
  MessageSquare,
  PenTool,
  Search,
  Settings as SettingsIcon,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/UseAuth";
import SettingsModal from "@/components/settings/SettingsModal";

import ChatSidebarHeader from "./ChatSidebarHeader";
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

interface WorkspaceLink {
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

type SidebarPanel = "projects" | "workspaces" | "history" | "settings";

const WORKSPACE_LINKS: WorkspaceLink[] = [
  {
    label: "Email",
    description: "Read your inbox, and let Zed draft or summarize replies.",
    path: "/inbox",
    icon: Inbox,
  },
  {
    label: "Research",
    description: "Ask Zed to look into a topic — it saves what it finds.",
    path: "/workspaces/research",
    icon: Search,
  },
  {
    label: "Business",
    description: "Plans, revenue notes, and reports about your business.",
    path: "/workspaces/business",
    icon: Briefcase,
  },
  {
    label: "Content",
    description: "Ideas, drafts, and scripts for what you publish.",
    path: "/workspaces/content",
    icon: PenTool,
  },
  {
    label: "Learning",
    description: "Things you're studying — Zed can quiz you or track progress.",
    path: "/workspaces/learning",
    icon: GraduationCap,
  },
  {
    label: "Trading",
    description: "Practice trades on paper (no real money). Advanced — skip if unsure.",
    path: "/trading",
    icon: TrendingUp,
  },
];

function SidebarDropdown({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.18em] transition-all ${
          isOpen
            ? "border-cyan-400/40 bg-white/10 text-white"
            : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/20 hover:text-foreground"
        }`}
      >
        <span>{title}</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? "rotate-180 text-cyan-300" : ""}`}
        />
      </button>
      {isOpen && <div className="space-y-2 pl-1">{children}</div>}
    </div>
  );
}

function NavButton({
  icon: Icon,
  label,
  description,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
        active
          ? "border-cyan-400/40 bg-white/10 text-white"
          : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/20 hover:text-foreground"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-5">{label}</span>
        {description && (
          <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

export default function ChatSidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onClose,
  isMobile = false,
}: ChatSidebarProps) {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openPanel, setOpenPanel] = useState<SidebarPanel | null>("projects");
  const { user, logout } = useAuth() as { user?: LocalUser; logout: () => Promise<void> };
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const compact = !!user?.personalization?.compactMessages;

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
        throw new Error(`HTTP ${res.status}${body ? ` - ${body.slice(0, 160)}` : ""}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (err: any) {
      console.error("[avatar] upload failed:", err);
      window.alert(err?.message || "Avatar upload failed");
    } finally {
      setIsUploadingPicture(false);
      e.target.value = "";
    }
  }

  function togglePanel(panel: SidebarPanel) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  function goTo(path: string) {
    navigate(path);
    if (isMobile && onClose) onClose();
  }

  function selectProject(projectId: string | null) {
    onSelectProject(projectId);
    if (isMobile && onClose) onClose();
  }

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
        navigate(`/chat/${data.id}`);
      }
      if (isMobile && onClose) onClose();
    },
  });

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
          title="Expand sidebar"
        >
          <MessageSquare size={20} />
        </Button>
        <Button
          onClick={() => createConversationMutation.mutate()}
          className="w-10 h-10 zed-gradient rounded-xl zed-button p-0"
          disabled={createConversationMutation.isPending}
          title="New conversation"
        >
          +
        </Button>
        <Button
          onClick={() => goTo("/trading")}
          variant="ghost"
          size="sm"
          className="w-10 h-10 zed-button rounded-xl text-muted-foreground hover:text-cyan-300"
          title="Trading"
        >
          <TrendingUp size={18} />
        </Button>
        <Button
          onClick={() => goTo("/inbox")}
          variant="ghost"
          size="sm"
          className="w-10 h-10 zed-button rounded-xl text-muted-foreground hover:text-cyan-300"
          title="Inbox"
        >
          <Inbox size={18} />
        </Button>
        <Button
          onClick={() => goTo("/history")}
          variant="ghost"
          size="sm"
          className="w-10 h-10 zed-button rounded-xl text-muted-foreground hover:text-cyan-300"
          title="History"
        >
          <Clock size={18} />
        </Button>
        <Button
          onClick={() => setIsCollapsed(false)}
          variant="ghost"
          size="sm"
          className="w-10 h-10 zed-button rounded-xl text-muted-foreground hover:text-cyan-300"
          title="Settings"
        >
          <SettingsIcon size={18} />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`${
        isMobile ? "w-full h-screen" : "w-80 h-full"
      } flex flex-col relative zed-glass ${isMobile ? "" : "border-r"} border-purple-500/30 backdrop-blur-xl`}
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

      <div className={`flex-1 px-4 overflow-y-auto ${compact ? "text-sm" : ""}`}>
        <div className={`${compact ? "space-y-3 py-3" : "space-y-3 py-4"}`}>
          <SidebarDropdown
            title="Projects"
            isOpen={openPanel === "projects"}
            onToggle={() => togglePanel("projects")}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => selectProject(null)}
                className={`flex-1 rounded-xl border px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-left transition-all ${
                  selectedProjectId === null
                    ? "border-cyan-400/40 bg-white/10 text-white"
                    : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                All chats
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCreateProject()}
                className="h-9 w-9 rounded-xl zed-button p-0 text-muted-foreground hover:text-foreground"
                title="New project"
              >
                +
              </Button>
            </div>

            {projects.length > 0 && (
              <div className={`${compact ? "space-y-1.5" : "space-y-2"}`}>
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`flex items-stretch gap-1 rounded-xl border ${
                      selectedProjectId === project.id
                        ? "border-cyan-400/40 bg-white/10"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <button
                      onClick={() => selectProject(project.id)}
                      className={`flex-1 px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-left ${
                        selectedProjectId === project.id
                          ? "text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {project.name}
                    </button>
                    <button
                      onClick={() => goTo(`/projects/${project.id}`)}
                      className="px-2 text-muted-foreground hover:text-cyan-300"
                      aria-label="Project settings"
                      title="Project settings and sources"
                    >
                      <FolderKanban size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SidebarDropdown>

          <SidebarDropdown
            title="Workspaces"
            isOpen={openPanel === "workspaces"}
            onToggle={() => togglePanel("workspaces")}
          >
            {WORKSPACE_LINKS.map((workspace) => (
              <NavButton
                key={workspace.path}
                icon={workspace.icon}
                label={workspace.label}
                description={workspace.description}
                active={location === workspace.path || (workspace.path === "/trading" && location.startsWith("/trading"))}
                onClick={() => goTo(workspace.path)}
              />
            ))}
          </SidebarDropdown>

          <SidebarDropdown
            title="History"
            isOpen={openPanel === "history"}
            onToggle={() => togglePanel("history")}
          >
            <NavButton
              icon={Clock}
              label="History"
              description="Activity, conversations, runs, approvals"
              active={location.startsWith("/history")}
              onClick={() => goTo("/history")}
            />
          </SidebarDropdown>

          <SidebarDropdown
            title="Settings"
            isOpen={openPanel === "settings"}
            onToggle={() => togglePanel("settings")}
          >
            <SettingsModal />
          </SidebarDropdown>
        </div>
      </div>

      <ChatSidebarUserCard
        user={user}
        isUploadingPicture={isUploadingPicture}
        onUpload={handleAvatarUpload}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className="border-t border-white/10 p-3 relative z-10">
        <ChatRuntimeFooter />
      </div>
    </div>
  );
}
