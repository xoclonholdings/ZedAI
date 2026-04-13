import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Conversation } from "@shared/schema";
import type { FilingProject } from "@/pages/chat";

interface ConversationListItemProps {
  conversation: Conversation;
  currentProjectId: string | null;
  projects: FilingProject[];
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onAssignProject: (projectId: string | null) => void;
}

function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) return "Today";

  if (diffInHours < 168) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function ConversationListItem({
  conversation,
  currentProjectId,
  projects,
  isActive,
  onSelect,
  onDelete,
  onAssignProject,
}: ConversationListItemProps) {
  const date = conversation.updatedAt || conversation.createdAt;

  return (
    <div
      className={`group relative cursor-pointer rounded-xl p-2.5 transition-all zed-button ${
        isActive
          ? "zed-glass border-purple-500/50 shadow-lg shadow-purple-500/20"
          : "hover:bg-white/5"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="mb-1 truncate text-sm font-medium text-foreground">
            {conversation.title || "New Conversation"}
          </h3>

          {conversation.preview && (
            <p className="mb-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
              {conversation.preview}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {formatDate(date)}
            </span>

            <div className="flex items-center gap-2">
              <select
                value={currentProjectId || ""}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onChange={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAssignProject(e.target.value || null);
                }}
                className="rounded-md border border-white/10 bg-black/50 px-2 py-1 text-[10px] text-muted-foreground"
              >
                <option value="">Inbox</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              {conversation.mode && (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] ${
                    conversation.mode === "agent"
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-cyan-500/20 text-cyan-400"
                  }`}
                >
                  {conversation.mode}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20 h-auto p-1 ml-2 rounded-lg"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
