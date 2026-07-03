import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
  selectedProjectId,
  isMobile = false,
  onOpenSidebar,
}: ChatAreaProps) {
  const { user } = useAuth();
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadConversationId, setUploadConversationId] = useState<string | null>(null);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const [composerValue, setComposerValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const abortRef = useRef<AbortController | null>(null);
  const { ensureConversationTitle } = useConversationMutations(conversation, conversationId);

  const compactMessages = !!user?.personalization?.compactMessages;
  const fontSize =
    (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const showTimestamps = !!user?.personalization?.showTimestamps;
  const activeUploadConversationId = uploadConversationId || conversationId;

  useEffect(() => {
    if (!isStreaming) {
      setLocalMessages(messages);
    }
  }, [messages, isStreaming]);

  useEffect(() => {
    if (conversationId) {
      setUploadConversationId(conversationId);
    }
  }, [conversationId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, streamingMessage, scrollToBottom]);

  async function createConversation(title: string) {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: title.trim().slice(0, 50) || "New Conversation", mode: "chat" }),
    });

    const newConversation = await response.json().catch(() => null);

    if (!response.ok || !newConversation?.id) {
      throw new Error("Conversation creation returned no id");
    }

    const newConversationId = newConversation.id as string;
    navigate(`/chat/${newConversationId}`);
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

    return newConversationId;
  }

  async function handleSend(message: string) {
    if (!message.trim() || isStreaming) return;
    setHasStartedTyping(true);
    setStreamingMessage("");

    let convId = conversationId;

    if (!convId) {
      try {
        convId = await createConversation(message);
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
      projectId: selectedProjectId || undefined,
      abortRef,
      setIsStreaming,
      setLocalMessages,
      queryClient,
    });
  }

  async function handleArchiveConversation() {
    if (!conversationId) return;
    const confirmed = window.confirm("Archive this chat? You can restore it from Settings > Archived Chats.");
    if (!confirmed) return;

    const response = await fetch(`/api/conversations/${conversationId}/archive`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      window.alert("Failed to archive this chat.");
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    setUploadConversationId(null);
    setShowFileUpload(false);
    navigate("/chat");
  }

  function handleFileUpload(_files?: File[], result?: { conversationId?: string }) {
    const uploadedConversationId = result?.conversationId || activeUploadConversationId;
    if (uploadedConversationId) {
      setUploadConversationId(uploadedConversationId);
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", uploadedConversationId, "files"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", uploadedConversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (conversationId !== uploadedConversationId) {
        navigate(`/chat/${uploadedConversationId}`);
      }
    }
    setShowFileUpload(false);
  }

  async function handleOpenFileUpload() {
    if (showFileUpload) {
      setShowFileUpload(false);
      return;
    }

    let convId = activeUploadConversationId;

    if (!convId) {
      try {
        convId = await createConversation("File upload");
      } catch (err) {
        console.error("Failed to create conversation for upload:", err);
        window.alert("Could not start a conversation for file upload.");
        return;
      }
    }

    setUploadConversationId(convId);
    setShowFileUpload(true);
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

        <ChatHeader
          isMobile={isMobile}
          onOpenSidebar={onOpenSidebar}
          canArchive={!!conversationId}
          onArchiveConversation={handleArchiveConversation}
        />

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

        {showFileUpload && activeUploadConversationId && (
          <FileUpload
            conversationId={activeUploadConversationId}
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
              onOpenFileUpload={handleOpenFileUpload}
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
