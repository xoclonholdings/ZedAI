import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatArea from "@/components/chat/ChatArea";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
const zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";
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

  // Fetch files for current conversation
  const { data: files = [] } = useQuery<DBFile[]>({
    queryKey: ["/api/conversations", conversationId, "files"],
    enabled: !!conversationId,
  });

  return (
    <div className="flex h-screen-mobile bg-black overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="w-80 flex-shrink-0">
          <ChatSidebar 
            conversations={conversations} 
            onClose={() => setIsSidebarOpen(false)}
            isMobile={false}
            onMenuClick={() => setIsSidebarOpen(true)}
          />
        </div>
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <>
          <div className={`
            fixed inset-y-0 left-0 z-50 w-80
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            transition-transform duration-200 ease-in-out
          `}>
            <ChatSidebar 
              conversations={conversations} 
              onClose={() => setIsSidebarOpen(false)}
              isMobile={true}
              onMenuClick={() => setIsSidebarOpen(true)}
            />
          </div>
          
          {/* Mobile Backdrop */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
        </>
      )}
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ChatArea 
          conversation={currentConversation}
          messages={messages}
          files={files}
          conversationId={conversationId}
          isMobile={isMobile}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      </div>
    </div>
  );
}
