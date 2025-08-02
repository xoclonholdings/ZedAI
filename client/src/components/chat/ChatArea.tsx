import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Plus, 
  Paperclip, 
  Mic,
  Sparkles,
  Zap,
  Rss,
  MessageSquare,
  Settings,
  Brain
} from "lucide-react";
// Proper ZED logo with modern design
const zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FileUpload from "./FileUpload";
import ChatMessage from "./ChatMessage";
import SocialFeed from "../social/SocialFeed";
import ModeSelector from "./ModeSelector";
import InlineChatPanel from "./InlineChatPanel";
import MemoryPanel from "./MemoryPanel";
import { useChat } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/useAuth";
import type { Conversation, Message, File as DBFile, ConversationMode } from "@shared/schema";

interface ChatAreaProps {
  conversation?: Conversation;
  messages: Message[];
  files: DBFile[];
  conversationId?: string;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

export default function ChatArea({ conversation, messages, files, conversationId, isMobile = false, onOpenSidebar }: ChatAreaProps) {
  const [inputValue, setInputValue] = useState("");
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showSocialFeed, setShowSocialFeed] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [currentMode, setCurrentMode] = useState<ConversationMode>(conversation?.mode as ConversationMode || "chat");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const { isStreaming, streamingMessage, sendMessage: sendChatMessage } = useChat(conversationId);

  const updateModeMutation = useMutation({
    mutationFn: async (mode: ConversationMode) => {
      if (!conversationId) return;
      return await apiRequest(`/api/conversations/${conversationId}`, "PATCH", { mode });
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
      }
    },
  });

  // Debug logging for ChatArea
  console.log("💬 ChatArea Debug:", {
    conversationId,
    messagesCount: messages.length,
    hasMessages: messages.length > 0,
    conversation: conversation?.id,
    firstMessage: messages[0]?.content?.substring(0, 50)
  });

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const message = inputValue.trim();
    console.log("🚀 User sending message:", message);
    console.log("📍 Conversation ID:", conversationId);
    console.log("🎯 Current mode:", currentMode);
    
    if (!conversationId) {
      console.error("❌ No conversation ID - creating new conversation");
      // Create a new conversation first
      try {
        const response = await apiRequest("POST", "/api/conversations", { mode: currentMode });
        const newConversation = await response.json() as { id: string };
        window.history.pushState({}, '', `/chat/${newConversation.id}`);
        return;
      } catch (error) {
        console.error("❌ Failed to create conversation:", error);
        return;
      }
    }
    
    setInputValue("");
    
    try {
      // Use the new AI routing sendMessage function from useChat
      await sendChatMessage(message);
    } catch (error) {
      console.error("❌ Handle send error:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleModeChange = async (mode: ConversationMode) => {
    setCurrentMode(mode);
    if (conversationId) {
      try {
        await updateModeMutation.mutateAsync(mode);
      } catch (error) {
        // Error handled by UI feedback
      }
    }
    setShowModeSelector(false);
  };

  const handleFileUpload = (files: any[]) => {
    if (conversationId) {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "files"] });
    }
    setShowFileUpload(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputValue(prev => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleGifSelect = (gif: string) => {
    setInputValue(prev => prev + `![GIF](${gif})`);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleTranslate = (text: string, targetLang: string) => {
    if (inputValue.trim()) {
      setInputValue(prev => `[Translate to ${targetLang}]: ${prev}`);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
    
    // Hide welcome message when user starts typing
    if (inputValue.trim() && !hasStartedTyping) {
      setHasStartedTyping(true);
    }
  }, [inputValue, hasStartedTyping]);

  return (
    <div className="flex-1 flex h-full relative overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating orbs */}
          <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-purple-600/10 to-cyan-500/10 rounded-full blur-3xl zed-float" />
          <div className="absolute bottom-40 right-20 w-48 h-48 bg-gradient-to-r from-pink-500/10 to-purple-600/10 rounded-full blur-3xl zed-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 rounded-full blur-2xl zed-float" style={{ animationDelay: '4s' }} />
          
          {/* Large glowing ZED logo centerpiece - Reactive to streaming */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Outer glow ring - Dynamic based on streaming state */}
              <div className={`absolute inset-0 w-96 h-96 md:w-[32rem] md:h-[32rem] bg-gradient-to-r rounded-full blur-3xl transition-all duration-500 ${
                isStreaming 
                  ? 'from-purple-500/20 via-cyan-500/20 to-pink-500/20 animate-ping' 
                  : 'from-purple-500/8 via-cyan-500/8 to-pink-500/8 animate-pulse'
              }`} />
              
              {/* Response pulse rings - Only visible when streaming */}
              {isStreaming && (
                <>
                  <div className="absolute inset-4 bg-gradient-to-r from-purple-500/25 via-cyan-500/25 to-pink-500/25 rounded-full blur-2xl animate-ping" style={{ animationDelay: '0.5s' }} />
                  <div className="absolute inset-12 bg-gradient-to-r from-cyan-500/30 via-pink-500/30 to-purple-500/30 rounded-full blur-xl animate-ping" style={{ animationDelay: '1s' }} />
                </>
              )}
              
              {/* Inner glow ring - Enhanced during streaming */}
              <div className={`absolute inset-8 rounded-full blur-2xl transition-all duration-300 ${
                isStreaming
                  ? 'bg-gradient-to-r from-purple-500/25 via-cyan-500/25 to-pink-500/25 zed-active-shimmer'
                  : 'bg-gradient-to-r from-purple-500/15 via-cyan-500/15 to-pink-500/15 zed-shimmer'
              }`} />
              
              {/* ZED logo container */}
              <div className="relative w-96 h-96 md:w-[32rem] md:h-[32rem] flex items-center justify-center">
                <img 
                  src={zLogoPath} 
                  alt="ZED" 
                  className={`w-48 h-48 md:w-80 md:h-80 transition-all duration-500 ${
                    isStreaming ? 'opacity-40 scale-105' : 'opacity-25 scale-100'
                  }`}
                  style={{
                    filter: isStreaming 
                      ? `
                        drop-shadow(0 0 60px rgba(168, 85, 247, 0.6))
                        drop-shadow(0 0 120px rgba(59, 130, 246, 0.5))
                        drop-shadow(0 0 180px rgba(236, 72, 153, 0.4))
                        brightness(1.2)
                        contrast(1.1)
                      `
                      : `
                        drop-shadow(0 0 50px rgba(168, 85, 247, 0.4))
                        drop-shadow(0 0 100px rgba(59, 130, 246, 0.3))
                        drop-shadow(0 0 150px rgba(236, 72, 153, 0.2))
                      `,
                    animation: isStreaming 
                      ? 'zed-active-pulse 0.8s ease-in-out infinite alternate' 
                      : 'zed-glow-pulse 6s ease-in-out infinite alternate'
                  }}
                />
                
                {/* Shimmer overlay - Faster during streaming */}
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0"
                  style={{
                    animation: isStreaming 
                      ? 'shimmer-fast 2s ease-in-out infinite' 
                      : 'shimmer-sweep 8s ease-in-out infinite',
                    background: isStreaming
                      ? 'linear-gradient(45deg, transparent 20%, rgba(255,255,255,0.2) 30%, rgba(168,85,247,0.5) 50%, rgba(59,130,246,0.4) 70%, rgba(255,255,255,0.2) 80%, transparent 90%)'
                      : 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 40%, rgba(168,85,247,0.3) 50%, rgba(59,130,246,0.2) 60%, rgba(255,255,255,0.1) 70%, transparent 80%)'
                  }}
                />
                
                {/* Active thinking indicator - Only during streaming */}
                {isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex space-x-3">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                      <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.6s' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 zed-glass relative z-10 flex-shrink-0">
          <Button
            variant="ghost"
            size="lg"
            className="flex items-center space-x-3 p-2 h-auto hover:bg-white/5 transition-all duration-300 rounded-lg hover:scale-105"
            onClick={() => {
              console.log('ChatArea ZED header clicked!', { isMobile, onOpenSidebar });
              if (onOpenSidebar) {
                onOpenSidebar();
              }
            }}
          >
            <img src={zLogoPath} alt="Z" className="w-6 h-6 md:w-8 md:h-8" />
            <div className="text-left">
              <h1 className="text-lg md:text-xl font-bold">
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
              </h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleModeChange(currentMode === 'chat' ? 'agent' : 'chat');
                }}
                className="text-xs md:text-sm text-muted-foreground hover:text-foreground p-0 h-auto transition-colors"
              >
                {currentMode === 'chat' ? 'Chat Mode' : 'Enhanced AI Assistant'}
                <Settings size={10} className="ml-1" />
              </Button>
            </div>
          </Button>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSocialFeed(!showSocialFeed)}
              className={`zed-button rounded-xl btn-touch ${showSocialFeed ? 'text-purple-400' : 'text-muted-foreground'}`}
            >
              <Rss size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMemoryPanel(!showMemoryPanel)}
              className={`zed-button rounded-xl btn-touch ${showMemoryPanel ? 'text-purple-400' : 'text-muted-foreground'}`}
            >
              <Brain size={16} className="mr-1" />
              Memory
            </Button>
          </div>
        </div>

        {/* Messages - Full Viewport Height */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 md:px-4 py-2 md:py-3 relative z-10">
          {/* Debug info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-muted-foreground bg-red-900/20 p-1 rounded text-center">
              Debug: Messages: {messages.length}, Streaming: {isStreaming.toString()}, Typing: {hasStartedTyping.toString()}
            </div>
          )}
          
          {/* Messages Container - Flex Layout */}
          <div className="max-w-4xl mx-auto h-full flex flex-col justify-end">
            {messages.length > 0 ? (
              <div className="space-y-2 md:space-y-3">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No messages yet</p>
                  <p className="text-sm">Start your conversation with ZED</p>
                </div>
              </div>
            )}
          </div>

          {/* Streaming message */}
          {isStreaming && (
            <div className="flex items-start space-x-2 max-w-4xl mx-auto">
              <Card className="flex-1 p-3 md:p-4 zed-message zed-glow ml-2">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <img src={zLogoPath} alt="Z" className="w-3 h-3" />
                    <span className="text-sm font-semibold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
                  </div>  
                  <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full zed-typing" />
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full zed-typing" style={{ animationDelay: '0.3s' }} />
                      <div className="w-1.5 h-1.5 bg-pink-400 rounded-full zed-typing" style={{ animationDelay: '0.6s' }} />
                    </div>
                  </Badge>
                </div>
                <div className="prose prose-sm max-w-none">
                  {streamingMessage ? (
                    <p className="whitespace-pre-wrap text-sm">{streamingMessage}</p>
                  ) : (
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Sparkles size={14} className="animate-pulse" />
                      <span>Thinking...</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* File Upload Area */}
        {showFileUpload && conversationId && (
          <FileUpload
            conversationId={conversationId}
            onUpload={handleFileUpload}
            onClose={() => setShowFileUpload(false)}
          />
        )}

        {/* Input Area */}
        <div className="border-t border-white/10 zed-glass p-2 md:p-3 relative z-10 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <div className="relative border border-input rounded-lg bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                  <div className="flex items-end">
                    {/* Left side: Inline Panel with emoji, GIF, translate, and settings */}
                    <div className="flex items-center pl-2 py-1.5 border-r border-input/50">
                      <InlineChatPanel
                        onEmojiSelect={handleEmojiSelect}
                        onGifSelect={handleGifSelect}
                        onTranslate={handleTranslate}
                      />
                    </div>
                    
                    {/* Center: Text Area */}
                    <Textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message ZED in ${currentMode} mode...`}
                      className="flex-1 bg-transparent border-0 resize-none min-h-[40px] text-sm px-3 py-2 pr-16 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      rows={1}
                      disabled={isStreaming}
                    />
                    
                    {/* Right side: File upload, microphone, and send button */}
                    <div className="flex items-center space-x-1 pr-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFileUpload(true)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-purple-400 transition-colors"
                        disabled={isStreaming}
                      >
                        <Paperclip size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-cyan-400 transition-colors"
                        disabled={isStreaming}
                      >
                        <Mic size={12} />
                      </Button>
                      <Button
                        onClick={handleSend}
                        size="sm"
                        className="zed-gradient hover:shadow-md hover:shadow-purple-500/25 zed-button rounded-lg h-6 w-6 p-0 transition-all duration-200 hover:scale-105"
                        disabled={!inputValue.trim() || isStreaming}
                      >
                        <Send size={12} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Feed Panel */}
      {showSocialFeed && !isMobile && (
        <div className="w-96 border-l border-white/10 zed-sidebar">
          <SocialFeed />
        </div>
      )}

      {/* Memory Panel */}
      <MemoryPanel 
        isOpen={showMemoryPanel}
        onClose={() => setShowMemoryPanel(false)}
        username={(user as any)?.username}
      />
    </div>
  );
}

type ChatMessage = {
  metadata: unknown;
  id: string;
  role: string;
  content: string;
  createdAt: Date | null;
  conversationId: string;
  attachments?: any[]; // Add this line
};