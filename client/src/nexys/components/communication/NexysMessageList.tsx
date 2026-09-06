import type { Message } from "@shared/schema";

import { NexysMessageItem } from "./NexysMessageItem";

interface NexysMessageListProps {
  readonly messages: readonly Message[];
  readonly isStreaming: boolean;
  readonly streamingMessage?: string;
  readonly hasStartedTyping: boolean;
  readonly messagesEndRef: React.RefObject<HTMLDivElement>;
  readonly onCopyMessage?: (message: Message) => void;
  readonly onEditMessage?: (message: Message) => void;
  readonly onContextChoice?: (choice: string) => void;
  readonly compact?: boolean;
  readonly fontSize?: "small" | "medium" | "large";
  readonly showTimestamps?: boolean;
}

function buildStreamingMessage(content: string, messages: readonly Message[]): Message {
  return {
    id: "streaming-assistant",
    conversationId: messages[messages.length - 1]?.conversationId || "streaming",
    role: "assistant",
    content,
    metadata: { streaming: true },
    createdAt: new Date(),
  } as Message;
}

export function NexysMessageList({
  messages,
  isStreaming,
  streamingMessage,
  hasStartedTyping,
  messagesEndRef,
  onCopyMessage,
  onEditMessage,
  onContextChoice,
  compact = false,
  fontSize = "medium",
  showTimestamps = false,
}: NexysMessageListProps) {
  const hasStreamingContent = Boolean(isStreaming && streamingMessage?.trim());
  const streamMessage = hasStreamingContent
    ? buildStreamingMessage(streamingMessage || "", messages)
    : null;

  return (
    <div
      className={`relative z-10 flex-1 overflow-y-auto px-3 pb-8 sm:px-4 md:px-6 ${
        compact ? "pt-2 md:pt-3" : "pt-3 md:pt-4"
      }`}
    >
      {messages.length === 0 && !isStreaming && !hasStartedTyping ? null : messages.length === 0 && !isStreaming ? (
        <div className="mx-auto max-w-3xl rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-center text-xs text-white/55 md:text-sm">
          Sent. Waiting for ZAR to respond. If nothing arrives in a few seconds, refresh or check logs.
        </div>
      ) : (
        <div className={`mx-auto w-full max-w-4xl ${compact ? "space-y-1" : "space-y-2"}`}>
          {messages.map((message, index) => (
            <NexysMessageItem
              key={message.id}
              message={message}
              onCopy={onCopyMessage}
              onEdit={message.role === "user" ? onEditMessage : undefined}
              onContextChoice={messages.slice(index + 1).some((item) => item.role === "user")
                ? undefined
                : onContextChoice}
              compact={compact}
              fontSize={fontSize}
              showTimestamp={showTimestamps}
            />
          ))}

          {streamMessage ? (
            <div aria-live="polite">
              <NexysMessageItem
                message={streamMessage}
                onCopy={onCopyMessage}
                onContextChoice={onContextChoice}
                compact={compact}
                fontSize={fontSize}
                showTimestamp={false}
              />
            </div>
          ) : isStreaming ? (
            <div className="sr-only" aria-live="polite">
              ZAR is preparing a response.
            </div>
          ) : null}
        </div>
      )}

      <div ref={messagesEndRef} className="h-1" />
    </div>
  );
}
