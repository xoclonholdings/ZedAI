import { Pencil, Trash2 } from "lucide-react";
import type { Conversation } from "@shared/schema";
import type { FilingProject } from "@/pages/chat";

interface ConversationListItemProps {
  conversation: Conversation;
  currentProjectId: string | null;
  projects: FilingProject[];
  isActive: boolean;
  compact?: boolean;
  fontSize?: "small" | "medium" | "large";
  showTimestamp?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onAssignProject: (projectId: string | null) => void;
  onRename: () => void;
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
  isActive,
  compact = false,
  fontSize = "medium",
  showTimestamp = true,
  onSelect,
  onDelete,
  onRename,
}: ConversationListItemProps) {
  const date = conversation.updatedAt || conversation.createdAt;
  const titleClass =
    fontSize === "small" ? "text-xs" : fontSize === "large" ? "text-base" : "text-[13px]";
  const padY = compact ? "py-1.5" : "py-2";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative flex cursor-pointer items-center gap-2 rounded-md pl-3 pr-2 ${padY} transition-colors ${
        isActive
          ? "bg-white/[0.06] text-white"
          : "text-foreground/90 hover:bg-white/[0.04]"
      }`}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-gradient-to-b from-cyan-400 to-fuchsia-500"
        />
      )}

      <span className={`min-w-0 flex-1 truncate ${titleClass}`}>
        {conversation.title || "New Conversation"}
      </span>

      {showTimestamp && (
        <span className="hidden shrink-0 text-[10px] text-muted-foreground/70 group-hover:hidden sm:inline">
          {formatDate(date)}
        </span>
      )}

      <div className="hidden items-center gap-0.5 group-hover:flex">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRename();
          }}
          className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-cyan-300"
          aria-label="Rename conversation"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-red-400"
          aria-label="Delete conversation"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
