import { useState } from "react";
import OldChatArea from "@/components/chat/OldChatArea";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { Button } from "@/components/ui/button";
import { Menu, Settings } from "lucide-react";
import type { Conversation } from "@shared/schema";

interface ChatFullPageProps {
    isMobile?: boolean;
}

export default function ChatFullPage({ isMobile = false }: ChatFullPageProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);

    // Mock conversations for sidebar
    const conversations: Conversation[] = [];

    return (
        <div className="h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex overflow-hidden">
            {/* Enhanced Dark Overlay */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />

            {/* Sidebar */}
            <div className={`
        relative z-10 h-full transition-all duration-300 ease-in-out flex-shrink-0
        ${isSidebarOpen
                    ? (isMobile ? 'w-full' : 'w-80')
                    : (isMobile ? 'w-0' : 'w-16')
                }
      `}>
                <ChatSidebar
                    conversations={conversations || []}
                    isMobile={isMobile}
                    onClose={() => setIsSidebarOpen(false)}
                    onMenuClick={() => setIsSidebarOpen(true)}
                />
            </div>

            {/* Main Content Container */}
            <div className="flex-1 flex flex-col min-h-0 max-w-full relative z-5">
                {/* Simple Navigation Bar */}
                <div className="border-b border-white/10 bg-gray-900/50 backdrop-blur-sm p-3 md:p-4 flex items-center justify-between relative z-10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="zed-button rounded-lg text-muted-foreground hover:text-purple-400"
                        >
                            <Menu size={18} />
                        </Button>
                    </div>

                    <div className="flex-1 text-center px-4">
                        <h1 className="text-sm md:text-lg font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                            ZED Advanced Interface
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="zed-button rounded-lg text-muted-foreground hover:text-foreground"
                        >
                            <Settings size={18} />
                        </Button>
                    </div>
                </div>

                {/* OLD Chat Interface - Full Screen */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    <OldChatArea />
                </div>
            </div>
        </div>
    );
}
