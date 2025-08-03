import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    MessageSquare,
    Plus,
    User,
    Settings,
    X,
    Bot
} from "lucide-react";
import type { Conversation } from "@shared/schema";

const zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";

interface TestSidebarProps {
    conversations?: Conversation[];
    onClose?: () => void;
    isMobile?: boolean;
    onMenuClick?: () => void;
}

// Simple test version of ChatSidebar - rebuilding piece by piece  
export default function TestSidebar({ conversations = [], onClose, isMobile = false }: TestSidebarProps) {
    const [currentMode, setCurrentMode] = useState<"chat" | "agent">("chat");

    return (
        <div className={`${isMobile ? 'w-full h-screen' : 'w-80 h-full'} flex flex-col bg-gray-900/50 border-r border-white/20 backdrop-blur-sm`}>
            {/* Clean Header */}
            <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center">
                            <img src={zLogoPath} alt="Z" className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white">ZED</h1>
                            <p className="text-xs text-gray-400">Test Sidebar</p>
                        </div>
                    </div>

                    {isMobile && (
                        <Button
                            onClick={onClose}
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white"
                        >
                            <X size={16} />
                        </Button>
                    )}
                </div>

                {/* Simple Mode Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-white/10">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentMode === 'chat' ? 'bg-cyan-500' : 'bg-purple-500'}`}>
                            {currentMode === 'chat' ? <MessageSquare size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white">{currentMode === 'chat' ? 'Chat' : 'Agent'} Mode</div>
                            <div className="text-xs text-gray-400">Clean test version</div>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentMode(currentMode === 'chat' ? 'agent' : 'chat')}
                        className="h-8 w-14 p-0 rounded-full bg-white/10 relative border border-white/20"
                    >
                        <div className={`absolute w-6 h-6 bg-white rounded-full transition-transform shadow-md ${currentMode === 'agent' ? 'translate-x-3' : '-translate-x-3'}`} />
                    </Button>
                </div>

                {/* New Chat Button */}
                <Button
                    className="w-full mt-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white"
                    size="sm"
                >
                    <Plus size={16} className="mr-2" />
                    New Chat
                </Button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">Conversations</h3>
                    <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 border-purple-500/30">
                        {conversations.length}
                    </Badge>
                </div>

                {conversations.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No conversations yet</p>
                        <p className="text-xs">Start a new chat to begin</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {conversations.map((conversation, index) => (
                            <div
                                key={conversation.id || index}
                                className="p-3 rounded-lg bg-gray-800/30 border border-white/10 hover:bg-gray-800/50 cursor-pointer transition-colors"
                            >
                                <h4 className="text-sm font-medium text-white truncate mb-1">
                                    {conversation.title || 'Untitled Chat'}
                                </h4>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-400">
                                        {conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleDateString() : 'Today'}
                                    </span>
                                    {conversation.mode && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${conversation.mode === 'agent'
                                                ? 'bg-purple-500/20 text-purple-400'
                                                : 'bg-cyan-500/20 text-cyan-400'
                                            }`}>
                                            {conversation.mode}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                            <User size={14} className="text-white" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white">Test User</div>
                            <div className="text-xs text-gray-400">test@example.com</div>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-white"
                    >
                        <Settings size={16} />
                    </Button>
                </div>
            </div>
        </div>
    );
}
