import ChatEmptyState from "./ChatEmptyState";
import ChatMessage from "./ChatMessage";
import ChatStreamIndicator from "./ChatStreamIndicator";
import type { AgentTarget, ConversationMode, Message } from "@shared/schema";

interface ChatMessagesListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingMessage?: string;
  hasStartedTyping: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onCopyMessage?: (message: Message) => void;
  onEditMessage?: (message: Message) => void;
  compact?: boolean;
  fontSize?: "small" | "medium" | "large";
  showTimestamps?: boolean;
  currentMode: ConversationMode;
  agentTarget: AgentTarget;
  onSelectSuggestion: (prompt: string) => void;
}

export default function ChatMessagesList({
  messages,
  isStreaming,
  streamingMessage,
  hasStartedTyping,
  messagesEndRef,
  onCopyMessage,
  onEditMessage,
  compact = false,
  fontSize = "medium",
  showTimestamps = false,
  currentMode,
  agentTarget,
  onSelectSuggestion,
}: ChatMessagesListProps) {
  return (
    <div className={`relative z-10 flex-1 overflow-y-auto px-4 md:px-6 ${compact ? "py-2 md:py-3" : "py-3 md:py-4"}`}>
      {messages.length === 0 && !isStreaming && !hasStartedTyping ? (
        <ChatEmptyState
          currentMode={currentMode}
          agentTarget={agentTarget}
          onSelectSuggestion={onSelectSuggestion}
        />
      ) : messages.length === 0 && !isStreaming ? (
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 zed-glass p-4 text-center text-xs text-muted-foreground md:text-sm">
          Your message was sent. If the response does not appear, refresh the conversation and check Admin logs.
        </div>
      ) : (
        <div className={`mx-auto max-w-4xl ${compact ? "space-y-1.5 md:space-y-2" : "space-y-3 md:space-y-4"}`}>
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onCopy={onCopyMessage}
              onEdit={message.role === "user" ? onEditMessage : undefined}
              compact={compact}
              fontSize={fontSize}
              showTimestamp={showTimestamps}
            />
          ))}
        </div>
      )}

      {false && isStreaming && (
        <ChatStreamIndicator streamingMessage={streamingMessage} />
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
