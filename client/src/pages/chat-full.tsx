import { useState } from "react";
import ChatArea from "@/components/chat/ChatArea";
import ChatSidebar from "@/components/chat/ChatSidebar";
import type { Conversation } from "@shared/schema";

interface ChatFullPageProps {
    isMobile?: boolean;
}

export default function ChatFullPage({ isMobile = false }: ChatFullPageProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default to closed

    // Mock conversations for sidebar
    const conversations: Conversation[] = [];

    return (
        <div className="h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex overflow-hidden relative">
            {/* Enhanced Dark Overlay */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />

            {/* Sidebar Overlay - Slide in from left */}
            <div className={`
                fixed top-0 left-0 h-full w-80 z-50 transform transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <ChatSidebar
                    conversations={conversations || []}
                    isMobile={isMobile}
                    onClose={() => setIsSidebarOpen(false)}
                    onMenuClick={() => setIsSidebarOpen(true)}
                />
            </div>

            {/* Backdrop overlay when sidebar is open */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col min-h-0 max-w-full relative z-10 w-full">
                {/* Chat Interface - Full Screen starts at top */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    <ChatArea onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
                </div>
            </div>
        </div>
    );
}
