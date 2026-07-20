import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/components/auth/UseAuth";

import ChatComposer from "./ChatComposer";
import ChatMessagesList from "./ChatMessagesList";
import FileUpload from "./FileUpload";
import FilesAttachedStrip from "./FilesAttachedStrip";
import { sendAgentMessage } from "./chat-area/sendAgentMessage";
import { useConversationMutations } from "./chat-area/useConversationMutations";

import type { AgentTarget, Conversation, Message, File as DBFile } from "@shared/schema";

interface ChatAreaProps {
  conversation?: Conversation;
  messages: Message[];
  files: DBFile[];
  conversationId?: string;
  selectedProjectId?: string | null;
  onAssignProject?: (conversationId: string, projectId: string | null) => Promise<void> | void;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
  workspaceContext?: AgentTarget;
  workspaceLabel?: string | null;
  workspaceSlug?: string | null;
  learningPathId?: string | null;
  lessonId?: string | null;
  onBeforeSend?: (message: string) => boolean | Promise<boolean>;
  onAgentResponse?: (data: unknown) => void;
  onConversationIdChange?: (conversationId: string) => void;
}

export default function ChatArea({
  conversation,
  messages,
  files,
  conversationId,
  selectedProjectId,
  isMobile = false,
  onOpenSidebar,
  workspaceContext,
  workspaceLabel,
  workspaceSlug,
  learningPathId,
  lessonId,
  onBeforeSend,
  onAgentResponse,
  onConversationIdChange,
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
      body: JSON.stringify({ title: title.trim().slice(0, 50) || "Conversation", mode: "chat" }),
    });

    const newConversation = await response.json().catch(() => null);

    if (!response.ok || !newConversation?.id) {
      throw new Error("Conversation creation returned no id");
    }

    const newConversationId = newConversation.id as string;
    navigate(`/chat/${newConversationId}`);
    onConversationIdChange?.(newConversationId);
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

    return newConversationId;
  }

  async function handleSend(message: string) {
    if (!message.trim() || isStreaming) return;
    const handled = await onBeforeSend?.(message);
    if (handled) return;

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
      agentTarget: workspaceContext,
      workspaceId: workspaceSlug || undefined,
      context: {
        ...(learningPathId ? { learningPathId } : {}),
        ...(lessonId ? { lessonId } : {}),
      },
      abortRef,
      setIsStreaming,
      setLocalMessages,
      queryClient,
      onResponse: onAgentResponse,
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
    navigate("/nexus");
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
      onConversationIdChange?.(uploadedConversationId);
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
    <div className="flex min-h-[520px] flex-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/45">
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] bg-white/[0.025] px-3 py-2.5 md:px-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-cyan-100/48">
              Conversation
            </div>
            <div className="truncate text-sm font-medium text-white/78">
              {workspaceLabel ? `In ${workspaceLabel}` : conversation?.title || "Nexus communication"}
            </div>
          </div>
          {conversationId ? (
            <button
              type="button"
              onClick={handleArchiveConversation}
              className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[12px] text-white/62 transition hover:border-orange-200/30 hover:text-orange-100"
            >
              Archive
            </button>
          ) : null}
        </div>

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
        />

        {showFileUpload && activeUploadConversationId && (
          <FileUpload
            conversationId={activeUploadConversationId}
            onUpload={handleFileUpload}
            onClose={() => setShowFileUpload(false)}
          />
        )}

        <FilesAttachedStrip files={files || []} />

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
              placeholder="Ask ZAR"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
