import ConversationListItem from "./ConversationListItem";
import type { Conversation } from "@shared/schema";
import type { FilingProject } from "@/pages/chat";
import { useAuth } from "@/components/auth/UseAuth";

interface ConversationListProps {
  conversations: Conversation[];
  projects: FilingProject[];
  currentPath: string;
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAssignProject: (conversationId: string, projectId: string | null) => void;
  onRename: (conversationId: string, currentTitle: string) => void;
}

export default function ConversationList({
  conversations,
  projects,
  currentPath,
  selectedProjectId,
  onSelect,
  onDelete,
  onAssignProject,
  onRename,
}: ConversationListProps) {
  const { user } = useAuth();
  const activeProjectConversationIds = new Set(
    selectedProjectId
      ? projects.find((project) => project.id === selectedProjectId)?.conversationIds || []
      : [],
  );

  const visibleConversations = selectedProjectId
    ? conversations.filter((conversation) => activeProjectConversationIds.has(conversation.id))
    : conversations;

  const projectIdByConversation = new Map<string, string>();
  const compact = !!user?.personalization?.compactMessages;
  const fontSize = (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const showTimestamps = !!user?.personalization?.showTimestamps;
  for (const project of projects) {
    for (const conversationId of project.conversationIds) {
      projectIdByConversation.set(conversationId, project.id);
    }
  }

  if (visibleConversations.length === 0) {
    return (
      <div className="py-6 text-center text-muted-foreground">
        <p className="text-sm">No conversations here yet</p>
        <p className="text-[11px]">Start a new chat or file one into this project</p>
      </div>
    );
  }

  return (
    <div className={`${compact ? "space-y-1.5 py-2" : "space-y-2 py-3"}`}>
      {visibleConversations.map((conversation) => (
        <ConversationListItem
          key={conversation.id}
          conversation={conversation}
          currentProjectId={projectIdByConversation.get(conversation.id) || null}
          projects={projects}
          isActive={
            currentPath === `/chat/${conversation.id}` ||
            currentPath === `/chat/${conversation.id}/`
          }
          compact={compact}
          fontSize={fontSize}
          showTimestamp={showTimestamps}
          onSelect={() => onSelect(conversation.id)}
          onDelete={() => onDelete(conversation.id)}
          onAssignProject={(projectId) => onAssignProject(conversation.id, projectId)}
          onRename={() => onRename(conversation.id, conversation.title || "New Chat")}
        />
      ))}
    </div>
  );
}
