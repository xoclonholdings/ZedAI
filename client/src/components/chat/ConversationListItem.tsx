import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Conversation } from "@shared/schema";

interface ConversationListItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
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
  onSelect,
  onDelete,
}: ConversationListItemProps) {
  const date = conversation.updatedAt || conversation.createdAt;

  return (
    <div
      className={`group relative p-3 rounded-xl cursor-pointer transition-all zed-button ${
        isActive
          ? "zed-glass border-purple-500/50 shadow-lg shadow-purple-500/20"
          : "hover:bg-white/5"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate mb-1">
            {conversation.title || "New Conversation"}
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
              <span
                className={`text-xs px-2 py-1 rounded-full ${
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
