import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyMessage } from "@/lib/notify";
import { useAuth } from "@/components/auth/UseAuth";

import ChatBackground from "./ChatBackground";
import ChatControls from "./ChatControls";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import ChatMessagesList from "./ChatMessagesList";
import FileUpload from "./FileUpload";

import type {
  Conversation,
  Message,
  File as DBFile,
  ConversationMode,
  AgentTarget,
} from "@shared/schema";

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
  files,
  conversationId,
  selectedProjectId,
  onAssignProject,
  isMobile = false,
  onOpenSidebar,
}: ChatAreaProps) {
  const { user } = useAuth();
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [currentMode, setCurrentMode] = useState<ConversationMode>(
    (conversation?.mode as ConversationMode) || "chat",
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const [agentTarget, setAgentTarget] = useState<AgentTarget>("auto");
  const [composerValue, setComposerValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const compactMessages = !!user?.personalization?.compactMessages;
  const fontSize = (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const showTimestamps = !!user?.personalization?.showTimestamps;

  // Keep localMessages in sync with prop (except when streaming)
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
  }, [localMessages, streamingMessage]);

  const updateModeMutation = useMutation({
    mutationFn: async (mode: ConversationMode) => {
      if (!conversationId) return null;
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error("Failed to update mode");
      return res.json();
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
      }
    },
  });

  const renameConversationMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to rename conversation");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", vars.id] });
    },
  });

  async function ensureConversationTitle(convId: string, message: string) {
    const rawTitle = (conversation?.title || "").trim().toLowerCase();
    const shouldRename =
      !conversation ||
      !conversation.title ||
      rawTitle === "new chat" ||
      rawTitle === "new conversation" ||
      rawTitle === "hello";

    if (!shouldRename) return;

    const title = message
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 8)
      .join(" ");

    if (title) {
      await renameConversationMutation.mutateAsync({ id: convId, title });
    }
  }

  // ─── SSE streaming chat (Chat mode) ──────────────────────────────────────

  async function sendChatMessage(message: string, convId: string) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsStreaming(true);
    setStreamingMessage("");

    // Optimistically add user message to local state
    const tempUser: Message = {
      id: `temp-user-${Date.now()}`,
      conversationId: convId,
      role: "user",
      content: message,
      metadata: null,
      createdAt: new Date(),
    };
    setLocalMessages((prev) => [...prev, tempUser]);

    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: message, stream: true }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let aiContent = "";
      let userMessageFromServer: Message | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "user_message") {
              userMessageFromServer = data.message;
            } else if (data.type === "token") {
              aiContent += data.token;
              setStreamingMessage(aiContent);
            } else if (data.type === "done" || data.type === "error") {
              const aiMessage: Message = data.message;
              setStreamingMessage("");
              setIsStreaming(false);
              // Replace temp user message with real one, add AI message
              setLocalMessages((prev) => {
                const withoutTemp = prev.filter((m) => m.id !== tempUser.id);
                return [
                  ...withoutTemp,
                  userMessageFromServer || tempUser,
                  aiMessage,
                ];
              });
              // Browser notification when tab is in background
              if (data.type === "done" && aiMessage?.content) {
                notifyMessage("ZED", aiMessage.content);
              }
              // Refresh in background
              queryClient.invalidateQueries({
                queryKey: ["/api/conversations", convId, "messages"],
              });
              queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("[Chat] SSE error:", err);
      setStreamingMessage("");
      setIsStreaming(false);
      setLocalMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          conversationId: convId,
          role: "assistant",
          content: "Connection error. Make sure Ollama is running locally.",
          metadata: null,
          createdAt: new Date(),
        },
      ]);
    }
  }

  // ─── Agent mode orchestration ─────────────────────────────────────────────

  async function sendAgentMessage(message: string, convId: string) {
    setIsStreaming(true);

    const tempUser: Message = {
      id: `temp-user-${Date.now()}`,
      conversationId: convId,
      role: "user",
      content: message,
      metadata: null,
      createdAt: new Date(),
    };
    setLocalMessages((prev) => [...prev, tempUser]);

    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, conversationId: convId, agentTarget }),
      });

      const data = await res.json();

      setLocalMessages((prev) => {
        const withoutTemp = prev.filter(
          (m) => m.id !== tempUser.id
        );
        return [
          ...withoutTemp,
          { ...tempUser, id: `user-${Date.now()}` },
          {
            id: `agent-${Date.now()}`,
            conversationId: convId,
            role: "assistant" as const,
            content: data.reply || data.error || "No response",
            metadata: { agent: data.agent },
            createdAt: new Date(),
          },
        ];
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", convId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    } catch (err) {
      console.error("[Agent] Error:", err);
    } finally {
      setIsStreaming(false);
    }
  }

  // ─── Main send handler ────────────────────────────────────────────────────

  async function handleSend(message: string) {
    if (!message.trim() || isStreaming) return;
    setHasStartedTyping(true);

    let convId = conversationId;

    if (!convId) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title: message.slice(0, 50), mode: currentMode }),
        });
        const newConv = await res.json();
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

    if (currentMode === "agent") {
      await sendAgentMessage(message, convId!);
    } else {
      await sendChatMessage(message, convId!);
    }
  }

  async function handleModeToggle(mode: ConversationMode) {
    setCurrentMode(mode);
    if (conversationId) {
      updateModeMutation.mutate(mode);
    }
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
    <div className="flex-1 flex h-screen relative overflow-hidden">
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
        />

        {showFileUpload && conversationId && (
          <FileUpload
            conversationId={conversationId}
            onUpload={handleFileUpload}
            onClose={() => setShowFileUpload(false)}
          />
        )}

        <div className="border-t border-white/10 zed-glass p-4 md:p-6 flex-shrink-0 z-10">
          <div className="max-w-4xl mx-auto space-y-3">
            <ChatControls
              currentMode={currentMode}
              onModeToggle={handleModeToggle}
              onOpenFileUpload={() => setShowFileUpload(true)}
              onOpenVoice={() => {}}
              agentTarget={agentTarget}
              onAgentTargetChange={setAgentTarget}
            />
            <ChatInput
              onSend={handleSend}
              isLoading={isStreaming}
              value={composerValue}
              onValueChange={setComposerValue}
              editModeLabel={editingMessageId ? "Editing message draft" : null}
              onCancelEdit={editingMessageId ? () => { setEditingMessageId(null); setComposerValue(""); } : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
