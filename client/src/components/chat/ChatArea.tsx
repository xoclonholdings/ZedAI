import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Paperclip,
  Rss,
  Settings,
  Sparkles,
} from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { useChat } from "@/hooks/use-chat";

import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import ChatEmptyState from "./ChatEmptyState";
import ChatStreamIndicator from "./ChatStreamIndicator";
import FileUpload from "./FileUpload";
import ModeSelector from "./ModeSelector";
import SocialFeed from "../social/SocialFeed";

import zLogoPath from "@assets/IMG_2227_1753477194826.png";
import type {
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
  isMobile?: boolean;
}

export default function ChatArea({
  conversation,
  messages,
  files,
  conversationId,
  isMobile = false,
}: ChatAreaProps) {
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showSocialFeed, setShowSocialFeed] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [currentMode, setCurrentMode] = useState<ConversationMode>(
    (conversation?.mode as ConversationMode) || "chat",
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { isStreaming, streamingMessage } = useChat(conversationId);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: {
      message: string;
      conversationId?: string;
      mode?: ConversationMode;
    }) => {
      if (!data.conversationId) {
        throw new Error("No conversation ID provided");
      }

      return await apiRequest(
        `/api/conversations/${data.conversationId}/messages`,
        "POST",
        {
          content: data.message,
          role: "user",
        },
      );
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", conversationId, "messages"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations"],
        });
      }
    },
  });

  const updateModeMutation = useMutation({
    mutationFn: async (mode: ConversationMode) => {
      if (!conversationId) return null;

      return await apiRequest(`/api/conversations/${conversationId}`, "PATCH", {
        mode,
      });
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", conversationId],
        });
      }
    },
  });

  async function handleSend(message: string) {
    if (!message.trim()) return;

    setHasStartedTyping(true);

    if (!conversationId) {
      try {
        const newConversation = await apiRequest("/api/conversations", "POST", {
          title: message.slice(0, 50),
          mode: currentMode,
        });

        window.history.pushState({}, "", `/chat/${newConversation.id}`);
        return;
      } catch (error) {
        console.error("Failed to create conversation:", error);
        return;
      }
    }

    try {
      await sendMessageMutation.mutateAsync({
        message,
        conversationId,
        mode: currentMode,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }

  async function handleModeChange(mode: ConversationMode) {
    setCurrentMode(mode);

    if (conversationId) {
      try {
        await updateModeMutation.mutateAsync(mode);
      } catch (error) {
        console.error("Failed to update mode:", error);
      }
    }

    setShowModeSelector(false);
  }

  function handleFileUpload() {
    if (conversationId) {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", conversationId, "files"],
      });
    }

    setShowFileUpload(false);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  return (
    <div className="flex-1 flex h-screen-mobile relative overflow-hidden">
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-purple-600/10 to-cyan-500/10 rounded-full blur-3xl zed-float" />
          <div
            className="absolute bottom-40 right-20 w-48 h-48 bg-gradient-to-r from-pink-500/10 to-purple-600/10 rounded-full blur-3xl zed-float"
            style={{ animationDelay: "2s" }}
          />
          <div
            className="absolute top-1/2 left-1/3 w-24 h-24 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 rounded-full blur-2xl zed-float"
            style={{ animationDelay: "4s" }}
          />
        </div>

        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 zed-glass relative z-10 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-lg md:text-xl font-bold flex items-center space-x-2">
                <img src={zLogoPath} alt="Z" className="w-4 h-4 md:w-5 md:h-5" />
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                  ZED
                </span>
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Enhanced AI Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSocialFeed((prev) => !prev)}
              className={`zed-button rounded-xl btn-touch ${
                showSocialFeed ? "text-purple-400" : "text-muted-foreground"
              }`}
            >
              <Rss size={16} />
            </Button>

            <Badge
              variant="secondary"
              className="zed-glass border-purple-500/20 text-purple-300"
            >
              <Sparkles size={12} className="mr-1" />
              Active
            </Badge>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6 relative z-10">
          {messages.length === 0 && !isStreaming && !hasStartedTyping ? (
            <ChatEmptyState />
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

        {showFileUpload && conversationId && (
          <FileUpload
            conversationId={conversationId}
            onUpload={handleFileUpload}
            onClose={() => setShowFileUpload(false)}
          />
        )}

        {showModeSelector && (
          <div className="border-t border-white/10 p-4 md:p-6 zed-glass relative z-20 max-h-[60vh] overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <ModeSelector
                selectedMode={currentMode}
                onModeChange={handleModeChange}
                disabled={updateModeMutation.isPending}
              />
            </div>
          </div>
        )}

        <div className="border-t border-white/10 zed-glass p-4 md:p-6 relative z-10 flex-shrink-0">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFileUpload(true)}
                  className="zed-button text-muted-foreground hover:text-purple-400 h-auto p-2 rounded-xl btn-touch"
                >
                  <Paperclip size={18} />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModeSelector((prev) => !prev)}
                  className="zed-button text-muted-foreground hover:text-cyan-400 h-auto px-3 py-2 rounded-xl flex items-center space-x-1 btn-touch"
                >
                  {currentMode === "chat" ? (
                    <MessageSquare size={14} />
                  ) : (
                    <img src={zLogoPath} alt="Z" className="w-3.5 h-3.5" />
                  )}

                  <span className="text-xs capitalize">{currentMode}</span>
                  <Settings size={10} />
                </Button>
              </div>

              <div className="text-xs text-muted-foreground flex items-center">
                <Sparkles size={12} className="mr-1 text-purple-400" />
                {files.length} file{files.length === 1 ? "" : "s"} attached
              </div>
            </div>

            <ChatInput
              onSend={handleSend}
              isLoading={sendMessageMutation.isPending || isStreaming}
            />
          </div>
        </div>
      </div>

      {showSocialFeed && !isMobile && (
        <div className="w-96 border-l border-white/10 zed-sidebar">
          <SocialFeed />
        </div>
      )}
    </div>
  );
}