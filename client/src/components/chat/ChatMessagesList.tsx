import ChatEmptyState from "./ChatEmptyState";
import ChatMessage from "./ChatMessage";
import ChatStreamIndicator from "./ChatStreamIndicator";
import type { Message } from "@shared/schema";

interface ChatMessagesListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingMessage?: string;
  hasStartedTyping: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export default function ChatMessagesList({
  messages,
  isStreaming,
  streamingMessage,
  hasStartedTyping,
  messagesEndRef,
}: ChatMessagesListProps) {
  return (
    <div className="relative z-10 flex-1 overflow-y-auto px-4 py-3 md:px-6 md:py-4">
      {messages.length === 0 && !isStreaming && !hasStartedTyping ? (
        <ChatEmptyState />
      ) : messages.length === 0 && !isStreaming ? (
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 zed-glass p-4 text-center text-xs text-muted-foreground md:text-sm">
          Your message was sent. If the response does not appear, refresh the conversation and check Admin logs.
        </div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-3 md:space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      )}

      {isStreaming && (
        <ChatStreamIndicator streamingMessage={streamingMessage} />
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
