import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "@/lib/queryClient";
import { useChat } from "@/hooks/use-chat";

import ChatBackground from "./ChatBackground";
import ChatControls from "./ChatControls";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import ChatMessagesList from "./ChatMessagesList";
import FileUpload from "./FileUpload";
import ModeSelector from "./ModeSelector";
import SocialFeed from "../social/SocialFeed";

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
        <ChatBackground />

        <ChatHeader
          showSocialFeed={showSocialFeed}
          onToggleSocialFeed={() => setShowSocialFeed((prev) => !prev)}
        />

        <ChatMessagesList
          messages={messages}
          isStreaming={isStreaming}
          streamingMessage={streamingMessage}
          hasStartedTyping={hasStartedTyping}
          messagesEndRef={messagesEndRef}
        />

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
            <ChatControls
              currentMode={currentMode}
              filesCount={files.length}
              onOpenFileUpload={() => setShowFileUpload(true)}
              onToggleModeSelector={() =>
                setShowModeSelector((prev) => !prev)
              }
            />

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