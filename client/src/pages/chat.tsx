import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatArea from "@/components/chat/ChatArea";

import type { Conversation, Message, File as DBFile } from "@shared/schema";

export default function Chat() {
  const { id: conversationId } = useParams<{ id?: string }>();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function checkMobile() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (!mobile) {
        setIsSidebarOpen(true);
      }
    }

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 30000,
  });

  const { data: currentConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
    refetchInterval: 5000,
  });

  const { data: files = [] } = useQuery<DBFile[]>({
    queryKey: ["/api/conversations", conversationId, "files"],
    enabled: !!conversationId,
  });

  return (
    <div className="flex h-screen-mobile bg-black relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 0, 255, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 0, 255, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl zed-float" />
        <div
          className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl zed-float"
          style={{ animationDelay: "4s" }}
        />
        <div
          className="absolute top-1/2 left-1/3 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl zed-float"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {isMobile && (
        <Button
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className="fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-black/80 backdrop-blur-sm border border-purple-500/30 hover:bg-purple-500/20 transition-all duration-200"
          size="sm"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      )}

      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
        className={`
          ${isMobile ? "sidebar-mobile" : "sidebar-desktop"}
          ${isMobile && !isSidebarOpen ? "hidden" : ""}
          ${isMobile ? "z-50" : "relative"}
        `}
      >
        <ChatSidebar
          conversations={conversations}
          onClose={() => setIsSidebarOpen(false)}
          isMobile={isMobile}
        />
      </div>

      <div className={`chat-area-mobile ${isMobile ? "w-full" : "flex-1"}`}>
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