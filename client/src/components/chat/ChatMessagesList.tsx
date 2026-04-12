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
    <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6 relative z-10">
      {messages.length === 0 && !isStreaming && !hasStartedTyping ? (
        <ChatEmptyState />
      ) : messages.length === 0 && !isStreaming ? (
        <div className="max-w-4xl mx-auto rounded-2xl border border-white/10 zed-glass p-6 text-center text-sm text-muted-foreground">
          Your message was sent. If the response does not appear, refresh the conversation and check Admin logs.
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
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
