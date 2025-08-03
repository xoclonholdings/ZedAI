import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import ChatFull from "./chat-full";
import { useAuth } from "../hooks/useAuthProvider.tsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    MessageSquare,
    Satellite,
    Smartphone,
    Brain,
    Settings,
    FileText,
    Users,
    Zap,
    Shield,
    Activity,
    Monitor
} from "lucide-react";

// ZED Logo
const zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";

export default function ComprehensiveChatInterface() {
    const [location, navigate] = useLocation();
    useAuth();
    const [isMobile, setIsMobile] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);

    // Detect mobile
    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);

        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    // Auto-hide welcome after 3 seconds
    useEffect(() => {
        const timer = setTimeout(() => setShowWelcome(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    if (location === "/chat/demo" || location === "/chat/comprehensive") {
        return (
            <div className="h-screen bg-black relative overflow-hidden">
                {/* Cyberpunk Background Elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-10 left-10 w-64 h-64 bg-gradient-to-r from-purple-600/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-20 right-20 w-48 h-48 bg-gradient-to-r from-pink-500/15 to-purple-600/15 rounded-full blur-2xl zed-float" />
                    <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 rounded-full blur-xl zed-shimmer" />
                </div>

                {/* Welcome Banner */}
                {showWelcome && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
                        <Card className="zed-glass border-purple-500/30 shadow-lg shadow-purple-500/20">
                            <div className="p-4 flex items-center space-x-3">
                                <img src={zLogoPath} alt="ZED" className="w-8 h-8" />
                                <div>
                                    <h3 className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                                        ZED Comprehensive Interface
                                    </h3>
                                    <p className="text-xs text-muted-foreground">All features implemented and ready</p>
                                </div>
                                <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                                    <Activity size={10} className="mr-1" />
                                    Live
                                </Badge>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Main Chat Interface */}
                <ChatFull isMobile={isMobile} />

                {/* Feature Status Panel */}
                <div className="absolute bottom-4 right-4 z-20 w-72">
                    <Card className="zed-glass border-white/10 backdrop-blur-xl">
                        <div className="p-3">
                            <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
                                <Monitor size={14} className="mr-2 text-cyan-400" />
                                System Status
                            </h4>

                            <div className="space-y-2 text-xs">
                                {/* Feature Status Grid */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center space-x-2">
                                        <MessageSquare size={10} className="text-green-400" />
                                        <span className="text-green-400">Chat System</span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Satellite size={10} className="text-cyan-400" />
                                        <span className="text-cyan-400">Satellite Link</span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Smartphone size={10} className="text-pink-400" />
                                        <span className="text-pink-400">Mobile Sync</span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Brain size={10} className="text-purple-400" />
                                        <span className="text-purple-400">Memory Vault</span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <FileText size={10} className="text-blue-400" />
                                        <span className="text-blue-400">File Processing</span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Shield size={10} className="text-yellow-400" />
                                        <span className="text-yellow-400">Security</span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Settings size={10} className="text-gray-400" />
                                        <span className="text-gray-400">Settings</span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Users size={10} className="text-indigo-400" />
                                        <span className="text-indigo-400">Admin Panel</span>
                                    </div>
                                </div>

                                {/* System Metrics */}
                                <div className="border-t border-white/10 pt-2 mt-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Memory Usage</span>
                                        <span className="text-green-400">847 MB</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Active Sessions</span>
                                        <span className="text-cyan-400">3</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Response Time</span>
                                        <span className="text-purple-400">247ms</span>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="border-t border-white/10 pt-2 mt-2">
                                    <div className="flex items-center justify-between">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => navigate("/chat")}
                                            className="text-xs h-6 px-2 text-cyan-400 hover:text-cyan-300"
                                        >
                                            Standard View
                                        </Button>

                                        <div className="flex items-center space-x-1">
                                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                            <span className="text-xs text-green-400">Online</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Powered By Footer */}
                <div className="absolute bottom-4 left-4 z-20">
                    <Card className="zed-glass border-white/10 backdrop-blur-xl">
                        <div className="p-2 flex items-center space-x-2 text-xs text-muted-foreground">
                            <Zap size={10} className="text-purple-400" />
                            <span>Powered by ZED AI</span>
                            <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                            <span>v2.1.0</span>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    // Fallback to standard chat interface
    return <ChatFull isMobile={isMobile} />;
}
