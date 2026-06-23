import ChatEmptyState from "./ChatEmptyState";
import ChatMessage from "./ChatMessage";
import type { Message } from "@shared/schema";

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
  onSelectSuggestion: (prompt: string) => void;
}

function buildStreamingMessage(content: string, messages: Message[]): Message {
  return {
    id: "streaming-assistant",
    conversationId: messages[messages.length - 1]?.conversationId || "streaming",
    role: "assistant",
    content,
    metadata: { streaming: true },
    createdAt: new Date(),
  } as Message;
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
  onSelectSuggestion,
}: ChatMessagesListProps) {
  const hasStreamingContent = Boolean(isStreaming && streamingMessage?.trim());
  const streamMessage = hasStreamingContent
    ? buildStreamingMessage(streamingMessage || "", messages)
    : null;

  return (
    <div
      className={`relative z-10 flex-1 overflow-y-auto px-3 pb-28 sm:px-4 md:px-6 md:pb-32 ${
        compact ? "pt-2 md:pt-3" : "pt-3 md:pt-4"
      }`}
    >
      {messages.length === 0 && !isStreaming && !hasStartedTyping ? (
        <ChatEmptyState onSelectSuggestion={onSelectSuggestion} />
      ) : messages.length === 0 && !isStreaming ? (
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 zed-glass p-4 text-center text-xs text-muted-foreground md:text-sm">
          Sent. Waiting for the assistant to respond. If nothing arrives in a few seconds,
          the provider call probably failed. Refresh or open Admin Logs to see the error.
        </div>
      ) : (
        <div className={`mx-auto w-full max-w-4xl ${compact ? "space-y-1" : "space-y-2"}`}>
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

          {streamMessage ? (
            <div aria-live="polite">
              <ChatMessage
                message={streamMessage}
                onCopy={onCopyMessage}
                compact={compact}
                fontSize={fontSize}
                showTimestamp={false}
              />
            </div>
          ) : isStreaming ? (
            <div className="sr-only" aria-live="polite">
              ZED is preparing a response.
            </div>
          ) : null}
        </div>
      )}

      <div ref={messagesEndRef} className="h-1" />
    </div>
  );
}
