import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ZedLogo } from "@/components/ui/zed-logo";
import {
    MessageSquare,
    Plus,
    Send,
    Menu,
    Search,
    Settings,
    Upload,
    Mic,
    Camera,
    Smile,
    Paperclip,
    User,
    Bot
} from "lucide-react"; interface Message {
    id: string;
    content: string;
    sender: 'user' | 'ai';
    timestamp: Date;
    type?: 'text' | 'file' | 'image';
}

interface Conversation {
    id: string;
    title: string;
    lastMessage?: string;
    timestamp: Date;
    messageCount: number;
}

export default function ChatFull() {
    const { id: conversationId } = useParams<{ id?: string }>();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [newMessage, setNewMessage] = useState("");
    const [showFileUpload, setShowFileUpload] = useState(false);

    // Mock data for development
    const mockConversations: Conversation[] = [
        {
            id: "1",
            title: "Getting Started with ZED",
            lastMessage: "How can I help you today?",
            timestamp: new Date(),
            messageCount: 5
        },
        {
            id: "2",
            title: "Code Review",
            lastMessage: "Let me analyze your code...",
            timestamp: new Date(Date.now() - 3600000),
            messageCount: 12
        },
        {
            id: "3",
            title: "Document Analysis",
            lastMessage: "I've processed your PDF file",
            timestamp: new Date(Date.now() - 7200000),
            messageCount: 8
        }
    ];

    const mockMessages: Message[] = [
        {
            id: "1",
            content: "Hello! I'm ZED, your AI assistant. How can I help you today?",
            sender: "ai",
            timestamp: new Date()
        },
        {
            id: "2",
            content: "I need help with React TypeScript development",
            sender: "user",
            timestamp: new Date()
        },
        {
            id: "3",
            content: "I'd be happy to help you with React TypeScript development! I can assist with component creation, type definitions, best practices, debugging, and more. What specific aspect would you like to work on?",
            sender: "ai",
            timestamp: new Date()
        }
    ];

    // Check if mobile on mount and resize
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(true);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleSendMessage = () => {
        if (!newMessage.trim()) return;

        // TODO: Implement actual message sending
        console.log("Sending message:", newMessage);
        setNewMessage("");
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="h-screen flex bg-black text-white overflow-hidden">
            {/* Sidebar */}
            <div className={`
        ${isSidebarOpen ? 'w-80' : 'w-0'} 
        ${isMobile ? 'absolute z-50 h-full' : 'relative'}
        transition-all duration-300 ease-in-out
        bg-gray-900 border-r border-gray-800 flex flex-col
      `}>
                {isSidebarOpen && (
                    <>
                        {/* Sidebar Header */}
                        <div className="p-4 border-b border-gray-800">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-2">
                                    <ZedLogo className="w-8 h-8" />
                                    <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent font-orbitron tracking-wider">
                                        ZED
                                    </h1>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsSidebarOpen(false)}
                                    className="md:hidden"
                                >
                                    <Menu className="w-5 h-5" />
                                </Button>
                            </div>

                            <Button
                                className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 font-space-grotesk font-medium"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                New Chat
                            </Button>
                        </div>

                        {/* Search */}
                        <div className="p-4 border-b border-gray-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Search conversations..."
                                    className="pl-10 bg-gray-800/70 border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 font-inter"
                                />
                            </div>
                        </div>

                        {/* Conversations List */}
                        <div className="flex-1 overflow-y-auto">
                            {mockConversations.map((conversation) => (
                                <div
                                    key={conversation.id}
                                    className={`
                    p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors
                    ${conversationId === conversation.id ? 'bg-gray-800 border-l-4 border-purple-500' : ''}
                  `}
                                >
                                    <div className="flex items-start space-x-3">
                                        <MessageSquare className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-white truncate font-space-grotesk">
                                                {conversation.title}
                                            </h3>
                                            <p className="text-sm text-gray-400 truncate mt-1 font-inter">
                                                {conversation.lastMessage}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-gray-500 font-space-grotesk">
                                                    {conversation.messageCount} messages
                                                </span>
                                                <span className="text-xs text-gray-500 font-inter">
                                                    {conversation.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Sidebar Footer */}
                        <div className="p-4 border-t border-gray-800">
                            <Button variant="ghost" className="w-full justify-start text-gray-400">
                                <Settings className="w-4 h-4 mr-2" />
                                Settings
                            </Button>
                        </div>
                    </>
                )}
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Chat Header */}
                <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-sm">
                    <div className="flex items-center space-x-3">
                        {!isSidebarOpen && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsSidebarOpen(true)}
                                className="hover:bg-purple-500/10"
                            >
                                <Menu className="w-5 h-5" />
                            </Button>
                        )}
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-white font-space-grotesk tracking-wide">ZED Assistant</h2>
                                <p className="text-xs text-gray-400 font-inter">Enhanced AI Intelligence</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-purple-500/10 hover:text-purple-400 transition-colors"
                        >
                            <Upload className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-purple-500/10 hover:text-purple-400 transition-colors"
                        >
                            <Settings className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {mockMessages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`
                flex max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}
              `}>
                                {/* Avatar */}
                                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  ${message.sender === 'user' ? 'ml-3 bg-gradient-to-r from-purple-500 to-pink-500' : 'mr-3 bg-gradient-to-r from-cyan-500 to-purple-500'}
                `}>
                                    {message.sender === 'user' ? (
                                        <User className="w-4 h-4 text-white" />
                                    ) : (
                                        <Bot className="w-4 h-4 text-white" />
                                    )}
                                </div>

                                {/* Message Bubble */}
                                <div className={`
                  rounded-2xl px-5 py-4 max-w-full shadow-lg
                  ${message.sender === 'user'
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-purple-500/20'
                                        : 'bg-gray-800/90 text-white border border-gray-700/50 backdrop-blur-sm'
                                    }
                `}>
                                    <p className="whitespace-pre-wrap font-inter leading-relaxed">{message.content}</p>
                                    <div className={`
                    text-xs mt-2 font-space-grotesk
                    ${message.sender === 'user' ? 'text-purple-100/80' : 'text-gray-400'}
                  `}>
                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Chat Input */}
                <div className="border-t border-gray-800 p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="flex items-end space-x-3">
                        {/* File Upload Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowFileUpload(!showFileUpload)}
                            className="flex-shrink-0 hover:bg-purple-500/10 hover:text-purple-400 transition-colors"
                        >
                            <Paperclip className="w-5 h-5" />
                        </Button>

                        {/* Message Input */}
                        <div className="flex-1 relative">
                            <Input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type your message to ZED..."
                                className="pr-24 bg-gray-800/70 border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 min-h-[48px] font-inter placeholder:text-gray-500 rounded-xl"
                                multiline
                            />

                            {/* Input Actions */}
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-8 h-8 hover:bg-purple-500/10 hover:text-purple-400"
                                >
                                    <Smile className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-8 h-8 hover:bg-purple-500/10 hover:text-cyan-400"
                                >
                                    <Mic className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Send Button */}
                        <Button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim()}
                            className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 flex-shrink-0 shadow-lg shadow-purple-500/25 font-space-grotesk font-medium px-6 h-12 rounded-xl"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Send
                        </Button>
                    </div>

                    {/* File Upload Options */}
                    {showFileUpload && (
                        <div className="mt-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <Button variant="ghost" className="flex flex-col items-center p-3 h-auto">
                                    <Upload className="w-6 h-6 mb-1 text-purple-400" />
                                    <span className="text-xs">Browse Files</span>
                                </Button>
                                <Button variant="ghost" className="flex flex-col items-center p-3 h-auto">
                                    <Camera className="w-6 h-6 mb-1 text-cyan-400" />
                                    <span className="text-xs">Take Photo</span>
                                </Button>
                                <Button variant="ghost" className="flex flex-col items-center p-3 h-auto">
                                    <Smile className="w-6 h-6 mb-1 text-pink-400" />
                                    <span className="text-xs">Gallery</span>
                                </Button>
                                <Button variant="ghost" className="flex flex-col items-center p-3 h-auto">
                                    <Search className="w-6 h-6 mb-1 text-yellow-400" />
                                    <span className="text-xs">Scan QR</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobile && isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
    );
}
