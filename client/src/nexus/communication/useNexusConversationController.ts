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
  readonly ensureUploadConversation: () => Promise<string | undefined>;
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
    if (isStreaming) return;
    // Keep the previous array when nothing changed - the incoming list can be a
    // fresh [] identity on every render while the query has no data, and
    // unconditionally cloning it re-triggers this effect in a render loop.
    setLocalMessages((previous) =>
      previous.length === 0 && messages.length === 0 ? previous : [...messages],
    );
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

  async function createConversation(titleSeed: string, options?: { navigateToChat?: boolean }) {
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
    // /nexus and /chat/:id are different <Route>s in the same Switch, so
    // navigating between them remounts this whole persistent console -
    // fine for sendMessage (nothing pending survives that matters), but
    // openFileUpload sets showFileUpload=true right after this call and
    // needs that update to survive, so it skips the navigate entirely.
    if (options?.navigateToChat !== false) navigate(`/chat/${newConversationId}`);
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
        // Never navigate away for this either - the console is a persistent
        // overlay on top of Nexus, not a page of its own; changing route
        // would remount the whole universe scene under it.
        activeConversationId = await createConversation(trimmed, { navigateToChat: false });
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
        activeConversationId = await createConversation("File upload", { navigateToChat: false });
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
   * Ensures a real conversation exists to attach into and returns its id
   * directly - for callers (like the Draw canvas) that need the id
   * immediately to POST an attachment, rather than waiting on a re-render
   * to see openFileUpload's state update.
   */
  async function ensureUploadConversation(): Promise<string | undefined> {
    if (activeUploadConversationId) return activeUploadConversationId;
    try {
      const newConversationId = await createConversation("Attachment", { navigateToChat: false });
      setUploadConversationId(newConversationId);
      return newConversationId;
    } catch (error) {
      console.error("Failed to create conversation for attachment:", error);
      return undefined;
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
    ensureUploadConversation,
    closeFileUpload: () => setShowFileUpload(false),
    handleFileUpload,
    archiveConversation,
    copyMessage,
    editMessage,
    cancelEdit,
  };
}
