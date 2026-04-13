import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { notifyMessage } from "@/lib/notify";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

import ChatBackground from "./ChatBackground";
import ChatControls from "./ChatControls";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import ChatMessagesList from "./ChatMessagesList";
import FileUpload from "./FileUpload";

import type {
  AgentTarget,
  Conversation,
  Message,
  File as DBFile,
  ConversationMode,
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
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [currentMode, setCurrentMode] = useState<ConversationMode>(
    (conversation?.mode as ConversationMode) || "chat",
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const [agentTarget, setAgentTarget] = useState<AgentTarget>("auto");
  const [stagedConversationId, setStagedConversationId] = useState<string | undefined>(conversationId);
  const [aiHostAlert, setAiHostAlert] = useState<{ title: string; description: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const activeConversationId = conversationId || stagedConversationId;

  useEffect(() => {
    if (conversationId) {
      setStagedConversationId(conversationId);
    }
  }, [conversationId]);

  // Keep localMessages in sync with prop (except when streaming)
  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      setLocalMessages(messages);
    }
  }, [messages, isStreaming]);

  const surfaceAiHostIssue = useCallback(
    (detail?: string) => {
      const normalized = (detail || "").toLowerCase();
      const isTimeout = normalized.includes("timeout");
      const isOffline =
        normalized.includes("404") ||
        normalized.includes("502") ||
        normalized.includes("fetch failed") ||
        normalized.includes("econnrefused");

      const title = isTimeout ? "AI host timed out" : isOffline ? "AI host is unavailable" : "AI host error";
      const description = isTimeout
        ? "The temporary Colab bridge took too long to answer. Re-open the notebook, warm it up, then test the AI host from Admin."
        : isOffline
          ? "The remote model bridge is offline or unreachable. Reconnect the Colab tunnel, then test the AI host from Admin."
          : detail || "The AI host returned an unexpected error.";

      setAiHostAlert({ title, description });
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
    [toast],
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, streamingMessage]);

  const updateModeMutation = useMutation({
    mutationFn: async (mode: ConversationMode) => {
      if (!activeConversationId) return null;
      const res = await fetch(`/api/conversations/${activeConversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error("Failed to update mode");
      return res.json();
    },
    onSuccess: () => {
      if (activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversationId] });
      }
    },
  });

  // ─── SSE streaming chat (Chat mode) ──────────────────────────────────────

  async function sendChatMessage(message: string, convId: string) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsStreaming(true);
    setStreamingMessage("");
    setAiHostAlert(null);

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
              if (data.type === "done") {
                setAiHostAlert(null);
              } else {
                surfaceAiHostIssue(data.error || aiMessage?.content);
              }
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
      const message =
        typeof err?.message === "string" && err.message.trim().length > 0
          ? err.message
          : "The remote AI host could not be reached.";
      surfaceAiHostIssue(message);
      setLocalMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          conversationId: convId,
          role: "assistant",
          content: `AI model error: ${message}`,
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

    const tempThinking: Message = {
      id: `temp-thinking-${Date.now()}`,
      conversationId: convId,
      role: "assistant",
      content: "⚡ Agent is working...",
      metadata: null,
      createdAt: new Date(),
    };
    setLocalMessages((prev) => [...prev, tempThinking]);

    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, conversationId: convId, targetAgent: agentTarget }),
      });

      const data = await res.json();

      setLocalMessages((prev) => {
        const withoutTemp = prev.filter(
          (m) => m.id !== tempUser.id && m.id !== tempThinking.id
        );
        return [
          ...withoutTemp,
          { ...tempUser, id: `user-${Date.now()}` },
          {
            id: `agent-${Date.now()}`,
            conversationId: convId,
            role: "assistant" as const,
            content: data.reply || data.error || "No response",
            metadata: { agent: data.agent, targetAgent: agentTarget },
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
      setLocalMessages((prev) =>
        prev.filter((m) => m.id !== tempThinking.id)
      );
    } finally {
      setIsStreaming(false);
    }
  }

  // ─── Main send handler ────────────────────────────────────────────────────

  async function handleSend(message: string) {
    if (!message.trim() || isStreaming) return;
    setHasStartedTyping(true);

    let convId = activeConversationId;
    let createdConversation = false;

    if (!convId) {
      try {
        convId = await ensureConversation(currentMode, false);
        if (selectedProjectId && onAssignProject) {
          await onAssignProject(convId, selectedProjectId);
        }
        createdConversation = true;
      } catch (err) {
        console.error("Failed to create conversation:", err);
        return;
      }
    }

    if (currentMode === "agent") {
      await sendAgentMessage(message, convId!);
    } else {
      await sendChatMessage(message, convId!);
    }

    if (createdConversation && convId) {
      navigate(`/chat/${convId}`);
    }
  }

  async function handleVoiceOpen() {
    try {
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      toast({
        title: "Voice workflow",
        description: data.note || "Voice controls are planned and currently browser-first.",
      });
    } catch {
      toast({
        title: "Voice workflow",
        description: "Voice controls are planned and currently browser-first.",
      });
    }
  }

  async function handleModeToggle(mode: ConversationMode) {
    setCurrentMode(mode);
    if (activeConversationId) {
      updateModeMutation.mutate(mode);
    }
  }

  async function ensureConversation(mode: ConversationMode = currentMode, navigateAfterCreate = true) {
    if (activeConversationId) {
      return activeConversationId;
    }

    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: "New Conversation", mode }),
    });

    if (!res.ok) {
      throw new Error("Failed to create conversation");
    }

    const newConv = await res.json();
    if (!newConv?.id) {
      throw new Error("Conversation response did not include an id");
    }

    const verifyRes = await fetch(`/api/conversations/${newConv.id}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!verifyRes.ok) {
      throw new Error(`Conversation verification failed (${verifyRes.status})`);
    }

    setStagedConversationId(newConv.id);
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    queryClient.setQueryData(["/api/conversations", newConv.id], newConv);
    if (navigateAfterCreate) {
      navigate(`/chat/${newConv.id}`);
    }
    return newConv.id as string;
  }

  function handleFileUpload() {
    if (activeConversationId) {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", activeConversationId, "files"],
      });
    }
    setShowFileUpload(false);
  }

  async function handleToggleFileUpload() {
    if (showFileUpload) {
      setShowFileUpload(false);
      return;
    }

    try {
      await ensureConversation();
      setShowFileUpload(true);
    } catch (error) {
      toast({
        title: "Upload unavailable",
        description: "Could not create a conversation for file upload. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="flex-1 flex h-screen relative overflow-hidden">
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <ChatBackground />

        <ChatHeader isMobile={isMobile} onOpenSidebar={onOpenSidebar} />

        {aiHostAlert && (
          <div className="px-4 pt-3 md:px-6 md:pt-4 relative z-10">
            <div className="mx-auto flex max-w-4xl items-start justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-200">{aiHostAlert.title}</p>
                <p className="mt-1 text-xs leading-5 text-red-100/80">{aiHostAlert.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-white/10 bg-black/30 px-3 text-xs"
                  onClick={() => navigate("/admin")}
                >
                  Test in Admin
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setAiHostAlert(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}

        <ChatMessagesList
          messages={localMessages}
          isStreaming={isStreaming}
          streamingMessage={streamingMessage}
          hasStartedTyping={hasStartedTyping}
          messagesEndRef={messagesEndRef}
        />

        <div className="border-t border-white/10 zed-glass p-4 md:p-6 flex-shrink-0 z-10">
          <div className="max-w-4xl mx-auto space-y-3">
        {showFileUpload && activeConversationId && (
          <div className="pointer-events-none absolute inset-x-4 bottom-28 z-20 md:inset-x-6 md:bottom-32">
            <div className="pointer-events-auto mx-auto max-w-4xl">
              <FileUpload
                conversationId={activeConversationId}
                onUpload={handleFileUpload}
                onClose={() => setShowFileUpload(false)}
              />
            </div>
          </div>
        )}
        <ChatControls
          currentMode={currentMode}
          onModeToggle={handleModeToggle}
          onOpenFileUpload={handleToggleFileUpload}
          onOpenVoice={handleVoiceOpen}
          agentTarget={agentTarget}
          onAgentTargetChange={setAgentTarget}
        />
            <ChatInput
              onSend={handleSend}
              isLoading={isStreaming}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
