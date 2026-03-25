import ConversationListItem from "./ConversationListItem";
import type { Conversation } from "@shared/schema";

interface ConversationListProps {
  conversations: Conversation[];
  currentPath: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ConversationList({
  conversations,
  currentPath,
  onSelect,
  onDelete,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs">Start a new chat to begin</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-4">
      {conversations.map((conversation) => (
        <ConversationListItem
          key={conversation.id}
          conversation={conversation}
          isActive={
            currentPath === `/chat/${conversation.id}` ||
            currentPath === `/chat/${conversation.id}/`
          }
          onSelect={() => onSelect(conversation.id)}
          onDelete={() => onDelete(conversation.id)}
        />
      ))}
    </div>
  );
}