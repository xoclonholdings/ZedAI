import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatArea from "@/components/chat/ChatArea";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import type { Conversation, Message, File as DBFile } from "@shared/schema";

export default function Chat() {
  const { id: conversationId } = useParams<{ id?: string }>();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true); // Always show sidebar on desktop
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch conversations for sidebar
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch current conversation if ID provided
  const { data: currentConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
  });

  // Fetch messages for current conversation
  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
    refetchInterval: 5000, // Refresh every 5 seconds when active
  });

  // Debug logging for messages
  console.log("💬 Chat Page Debug:", {
    conversationId,
    messagesCount: messages.length,
    messagesLoading,
    messagesError,
    messages: messages.slice(0, 2) // Show first 2 messages for debugging
  });

  // Fetch files for current conversation
  const { data: files = [] } = useQuery<DBFile[]>({
    queryKey: ["/api/conversations", conversationId, "files"],
    enabled: !!conversationId,
  });

  return (
    <div className="flex h-screen-mobile bg-black relative overflow-hidden">
      {/* Cyberpunk Grid Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{
             backgroundImage: `
               linear-gradient(rgba(139, 0, 255, 0.3) 1px, transparent 1px),
               linear-gradient(90deg, rgba(139, 0, 255, 0.3) 1px, transparent 1px)
             `,
             backgroundSize: '40px 40px'
           }} />
      
      {/* Cyberpunk Glow Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl zed-float" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl zed-float" style={{ animationDelay: '4s' }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl zed-float" style={{ animationDelay: '2s' }} />
      </div>
      
      {/* Mobile Menu Button */}
      {isMobile && (
        <Button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-black/80 backdrop-blur-sm border border-purple-500/30 hover:bg-purple-500/20 transition-all duration-200"
          size="sm"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      )}

      {/* Mobile Backdrop */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - Responsive */}
      <div className={`
        ${isMobile ? 'sidebar-mobile' : 'sidebar-desktop'} 
        ${isMobile && !isSidebarOpen ? 'hidden' : ''}
        ${isMobile ? 'z-50' : 'relative'}
      `}>
        <ChatSidebar 
          conversations={conversations} 
          onClose={() => setIsSidebarOpen(false)}
          isMobile={isMobile}
        />
      </div>
      
      {/* Chat Area - Responsive */}
      <div className={`chat-area-mobile ${isMobile ? 'w-full' : 'flex-1'}`}>
        <ChatArea 
          conversation={currentConversation}
          messages={messages}
          files={files}
          conversationId={conversationId}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}
