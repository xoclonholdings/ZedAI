import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/UseAuth";

import ChatBackground from "./ChatBackground";
import ChatComposer from "./ChatComposer";
import ChatHeader from "./ChatHeader";
import ChatMessagesList from "./ChatMessagesList";
import FileUpload from "./FileUpload";
import { sendAgentMessage } from "./chat-area/sendAgentMessage";
import { useConversationMutations } from "./chat-area/useConversationMutations";

import type { Conversation, Message, File as DBFile } from "@shared/schema";

interface ChatAreaProps {
  conversation?: Conversation;
  messages: Message[];
  files: DBFile[];
  conversationId?: string;
  selectedProjectId?: string | null;
  onAssignProject?: (conversationId: string, projectId: string | null) => Promise<void> | void;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

export default function ChatArea({
  conversation,
  messages,
  conversationId,
  isMobile = false,
  onOpenSidebar,
}: ChatAreaProps) {
  const { user } = useAuth();
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const [composerValue, setComposerValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const { ensureConversationTitle } = useConversationMutations(conversation, conversationId);

  const compactMessages = !!user?.personalization?.compactMessages;
  const fontSize =
    (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const showTimestamps = !!user?.personalization?.showTimestamps;

  useEffect(() => {
    if (!isStreaming) {
      setLocalMessages(messages);
    }
  }, [messages, isStreaming]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, streamingMessage, scrollToBottom]);

  async function handleSend(message: string) {
    if (!message.trim() || isStreaming) return;
    setHasStartedTyping(true);
    setStreamingMessage("");

    let convId = conversationId;

    if (!convId) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title: message.slice(0, 50), mode: "chat" }),
        });
        const newConv = await res.json();
        if (!newConv?.id) throw new Error("Conversation creation returned no id");
        convId = newConv.id;
        window.history.pushState({}, "", `/chat/${newConv.id}`);
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      } catch (err) {
        console.error("Failed to create conversation:", err);
        return;
      }
    }

    await ensureConversationTitle(convId!, message);
    setEditingMessageId(null);
    setComposerValue("");

    await sendAgentMessage({
      message,
      convId: convId!,
      abortRef,
      setIsStreaming,
      setLocalMessages,
      queryClient,
    });
  }

  function handleFileUpload() {
    if (conversationId) {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", conversationId, "files"],
      });
    }
    setShowFileUpload(false);
  }

  async function handleCopyMessage(message: Message) {
    await navigator.clipboard.writeText(message.content);
  }

  function handleEditMessage(message: Message) {
    setComposerValue(message.content);
    setEditingMessageId(message.id);
  }

  return (
    <div className="flex-1 flex h-safe-screen relative overflow-hidden">
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <ChatBackground />

        <ChatHeader isMobile={isMobile} onOpenSidebar={onOpenSidebar} />

        <ChatMessagesList
          messages={localMessages}
          isStreaming={isStreaming}
          streamingMessage={streamingMessage}
          hasStartedTyping={hasStartedTyping}
          messagesEndRef={messagesEndRef}
          onCopyMessage={handleCopyMessage}
          onEditMessage={handleEditMessage}
          compact={compactMessages}
          fontSize={fontSize}
          showTimestamps={showTimestamps}
          onSelectSuggestion={(prompt) => setComposerValue(prompt)}
        />

        {showFileUpload && conversationId && (
          <FileUpload
            conversationId={conversationId}
            onUpload={handleFileUpload}
            onClose={() => setShowFileUpload(false)}
          />
        )}

        <div className="border-t border-white/10 zed-glass px-3 pt-3 pb-safe md:px-4 md:pt-4 flex-shrink-0 z-10">
          <div className="max-w-4xl mx-auto">
            <ChatComposer
              value={composerValue}
              onValueChange={setComposerValue}
              onSend={handleSend}
              onAbort={() => abortRef.current?.abort()}
              isStreaming={isStreaming}
              onOpenFileUpload={() => setShowFileUpload(true)}
              editModeLabel={editingMessageId ? "Editing message draft" : null}
              onCancelEdit={
                editingMessageId
                  ? () => {
                      setEditingMessageId(null);
                      setComposerValue("");
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
