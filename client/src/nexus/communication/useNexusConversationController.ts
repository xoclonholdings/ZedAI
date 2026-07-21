import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

import { useAuth } from "@/components/auth/UseAuth";
import { sendAgentMessage } from "@/components/chat/chat-area/sendAgentMessage";
import { useConversationMutations } from "@/components/chat/chat-area/useConversationMutations";
import type { AgentTarget, Conversation, File as DBFile, Message } from "@shared/schema";

export interface UseNexusConversationControllerArgs {
  readonly conversation?: Conversation;
  readonly messages: readonly Message[];
  readonly files: readonly DBFile[];
  readonly conversationId?: string;
  readonly selectedProjectId?: string | null;
  readonly workspaceContext?: AgentTarget;
  readonly workspaceLabel?: string | null;
  readonly workspaceSlug?: string | null;
  readonly learningPathId?: string | null;
  readonly lessonId?: string | null;
  /** Currently focused Nexus root node — carried into the model context so ZAR answers from where the user is. */
  readonly nexusFocus?: string | null;
  readonly onBeforeSend?: (message: string) => boolean | Promise<boolean>;
  readonly onAgentResponse?: (data: unknown) => void;
  readonly onConversationIdChange?: (conversationId: string) => void;
}

export interface NexusConversationController {
  readonly conversation?: Conversation;
  readonly conversationId?: string;
  readonly title: string;
  readonly files: readonly DBFile[];
  readonly messages: readonly Message[];
  readonly isStreaming: boolean;
  readonly streamingMessage: string;
  readonly hasStartedTyping: boolean;
  readonly showFileUpload: boolean;
  readonly activeUploadConversationId?: string;
  readonly composerValue: string;
  readonly editingMessageId: string | null;
  readonly compactMessages: boolean;
  readonly fontSize: "small" | "medium" | "large";
  readonly showTimestamps: boolean;
  readonly runtimeError: string | null;
  readonly messagesEndRef: React.RefObject<HTMLDivElement>;
  readonly setComposerValue: (value: string) => void;
  readonly sendMessage: (message: string) => Promise<void>;
  readonly abort: () => void;
  readonly openFileUpload: () => Promise<void>;
  readonly ensureUploadConversationId: () => Promise<string | null>;
  readonly closeFileUpload: () => void;
  readonly handleFileUpload: (files?: File[], result?: { conversationId?: string }) => void;
  readonly archiveConversation: () => Promise<void>;
  readonly copyMessage: (message: Message) => Promise<void>;
  readonly editMessage: (message: Message) => void;
  readonly cancelEdit: () => void;
}

export function useNexusConversationController({
  conversation,
  messages,
  files,
  conversationId,
  selectedProjectId,
  workspaceContext,
  workspaceLabel,
  workspaceSlug,
  learningPathId,
  lessonId,
  nexusFocus,
  onBeforeSend,
  onAgentResponse,
  onConversationIdChange,
}: UseNexusConversationControllerArgs): NexusConversationController {
  const { user } = useAuth();
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadConversationId, setUploadConversationId] = useState<string | null>(null);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([...messages]);
  const [composerValue, setComposerValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { ensureConversationTitle } = useConversationMutations(conversation, conversationId);

  const compactMessages = Boolean(user?.personalization?.compactMessages);
  const fontSize =
    (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const showTimestamps = Boolean(user?.personalization?.showTimestamps);
  const activeUploadConversationId = uploadConversationId || conversationId;
  const title = workspaceLabel
    ? `In ${workspaceLabel}`
    : conversation?.title || "Nexus communication";

  useEffect(() => {
    if (!isStreaming) setLocalMessages([...messages]);
  }, [messages, isStreaming]);

  useEffect(() => {
    if (conversationId) setUploadConversationId(conversationId);
  }, [conversationId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, streamingMessage, scrollToBottom]);

  async function createConversation(titleSeed: string) {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: titleSeed.trim().slice(0, 50) || "Conversation",
        mode: "chat",
      }),
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

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || isStreaming) return;

    const handled = await onBeforeSend?.(trimmed);
    if (handled) {
      setComposerValue("");
      return;
    }

    setRuntimeError(null);
    setHasStartedTyping(true);
    setStreamingMessage("");

    let activeConversationId = conversationId;
    if (!activeConversationId) {
      try {
        activeConversationId = await createConversation(trimmed);
      } catch (error) {
        console.error("Failed to create conversation:", error);
        setRuntimeError("Could not start a conversation. Try again.");
        return;
      }
    }

    await ensureConversationTitle(activeConversationId, trimmed);
    setEditingMessageId(null);
    setComposerValue("");

    await sendAgentMessage({
      message: trimmed,
      convId: activeConversationId,
      projectId: selectedProjectId || undefined,
      agentTarget: workspaceContext,
      workspaceId: workspaceSlug || undefined,
      context: {
        ...(learningPathId ? { learningPathId } : {}),
        ...(lessonId ? { lessonId } : {}),
        ...(nexusFocus ? { nexusFocus } : {}),
      },
      abortRef,
      setIsStreaming,
      setLocalMessages,
      queryClient,
      onResponse: onAgentResponse,
    });
  }

  async function archiveConversation() {
    if (!conversationId) return;
    const confirmed = window.confirm("Archive this conversation?");
    if (!confirmed) return;

    const response = await fetch(`/api/conversations/${conversationId}/archive`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      window.alert("Failed to archive this conversation.");
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
      if (conversationId !== uploadedConversationId) navigate(`/chat/${uploadedConversationId}`);
      onConversationIdChange?.(uploadedConversationId);
    }
    setShowFileUpload(false);
  }

  async function openFileUpload() {
    if (showFileUpload) {
      setShowFileUpload(false);
      return;
    }

    let activeConversationId = activeUploadConversationId;
    if (!activeConversationId) {
      try {
        activeConversationId = await createConversation("File upload");
      } catch (error) {
        console.error("Failed to create conversation for upload:", error);
        window.alert("Could not start a conversation for file upload.");
        return;
      }
    }

    setUploadConversationId(activeConversationId);
    setShowFileUpload(true);
  }

  /**
   * Resolve (creating if needed) the conversation that mode-specific
   * upload surfaces (image, doc, upload, draw) should attach files to —
   * without toggling the legacy upload panel.
   */
  async function ensureUploadConversationId(): Promise<string | null> {
    if (activeUploadConversationId) return activeUploadConversationId;
    try {
      const created = await createConversation("File upload");
      setUploadConversationId(created);
      return created;
    } catch (error) {
      console.error("Failed to create conversation for upload:", error);
      setRuntimeError("Could not start a conversation for this upload.");
      return null;
    }
  }

  async function copyMessage(message: Message) {
    await navigator.clipboard.writeText(message.content);
  }

  function editMessage(message: Message) {
    setComposerValue(message.content);
    setEditingMessageId(message.id);
  }

  function cancelEdit() {
    setEditingMessageId(null);
    setComposerValue("");
  }

  return {
    conversation,
    conversationId,
    title,
    files,
    messages: localMessages,
    isStreaming,
    streamingMessage,
    hasStartedTyping,
    showFileUpload,
    activeUploadConversationId,
    composerValue,
    editingMessageId,
    compactMessages,
    fontSize,
    showTimestamps,
    runtimeError,
    messagesEndRef,
    setComposerValue,
    sendMessage,
    abort: () => abortRef.current?.abort(),
    openFileUpload,
    ensureUploadConversationId,
    closeFileUpload: () => setShowFileUpload(false),
    handleFileUpload,
    archiveConversation,
    copyMessage,
    editMessage,
    cancelEdit,
  };
}
