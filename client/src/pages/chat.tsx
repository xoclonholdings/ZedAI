import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatArea from "@/components/chat/ChatArea";
import type { Conversation, Message, File as DBFile } from "@shared/schema";

export type FilingProject = {
  id: string;
  name: string;
  color: string;
  conversationIds: string[];
};

export default function Chat() {
  const { id: conversationId } = useParams<{ id?: string }>();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

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

  const { data: projects = [], refetch: refetchProjects } = useQuery<FilingProject[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      return data.projects || [];
    },
  });

  // Fetch current conversation if ID provided
  const { data: currentConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
  });

  // Fetch messages for current conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
    refetchInterval: 5000, // Refresh every 5 seconds when active
  });

  // Fetch files for current conversation
  const { data: files = [] } = useQuery<DBFile[]>({
    queryKey: ["/api/conversations", conversationId, "files"],
    enabled: !!conversationId,
  });

  async function handleCreateProject() {
    const name = window.prompt("Name this project");
    if (!name?.trim()) return;

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: name.trim() }),
    });

    if (response.ok) {
      await refetchProjects();
    }
  }

  async function handleAssignProject(conversationIdToAssign: string, projectId: string | null) {
    const response = await fetch(`/api/conversations/${conversationIdToAssign}/project`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId }),
    });

    if (response.ok) {
      await refetchProjects();
    }
  }

  return (
    <div className="flex h-screen-mobile bg-black overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="w-80 flex-shrink-0">
          <ChatSidebar 
            conversations={conversations} 
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onCreateProject={handleCreateProject}
            onAssignProject={handleAssignProject}
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
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onCreateProject={handleCreateProject}
              onAssignProject={handleAssignProject}
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
          selectedProjectId={selectedProjectId}
          onAssignProject={handleAssignProject}
          isMobile={isMobile}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      </div>
    </div>
  );
}
