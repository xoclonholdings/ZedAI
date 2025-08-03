import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  MessageSquare,
  Brain
} from "lucide-react";

// ZED logo from original
const zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";

interface ChatAreaProps {
  onSidebarToggle?: () => void;
}

// ChatArea component - Original interface design
export default function ChatArea({ onSidebarToggle }: ChatAreaProps = {}) {
  const [inputValue, setInputValue] = useState("");
  const [showSocialFeed, setShowSocialFeed] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    console.log("Old interface message:", inputValue);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex h-full relative overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating orbs */}
          <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-purple-600/10 to-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-40 right-20 w-48 h-48 bg-gradient-to-r from-pink-500/10 to-purple-600/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 rounded-full blur-2xl" />

          {/* Large glowing ZED logo centerpiece - Original design */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Outer glow ring */}
              <div className="absolute inset-0 w-96 h-96 md:w-[32rem] md:h-[32rem] bg-gradient-to-r from-purple-500/8 via-cyan-500/8 to-pink-500/8 rounded-full blur-3xl animate-pulse" />

              {/* Inner glow ring */}
              <div className="absolute inset-8 bg-gradient-to-r from-purple-500/15 via-cyan-500/15 to-pink-500/15 rounded-full blur-2xl" />

              {/* ZED logo container */}
              <div className="relative w-96 h-96 md:w-[32rem] md:h-[32rem] flex items-center justify-center">
                <img
                  src={zLogoPath}
                  alt="ZED"
                  className="w-48 h-48 md:w-80 md:h-80 opacity-25 scale-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Header - Original Design */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 relative z-10 flex-shrink-0 bg-black">
          {/* Left side - Menu button and ZED branding */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {/* Clickable ZED Logo that triggers sidebar */}
              <button
                onClick={onSidebarToggle}
                className="w-10 h-10 p-1 rounded-lg hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-blue-500/20 transition-all duration-300 hover:scale-105 border border-transparent hover:border-purple-500/50 bg-transparent flex items-center justify-center"
                title="Open ZED Menu"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 md:w-8 md:h-8"
                >
                  <defs>
                    <linearGradient id="zedGradient123" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
                      <stop offset="50%" stopColor="#308cff" stopOpacity={1} />
                      <stop offset="100%" stopColor="#eb4899" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <rect width="40" height="40" rx="8" fill="url(#zedGradient123)" />
                  <path d="M8 12h20l-12 8h20v3H14l12-8H8v-3z" fill="white" fillOpacity="0.9" />
                </svg>
              </button>
              <div className="text-left">
                <h1 className="text-lg md:text-xl font-bold">
                  <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">ZED</span>
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">Enhanced AI Assistant</p>
              </div>
            </div>
          </div>

          {/* Right side - WiFi signal, satellite panel, and memory panel */}
          <div className="flex items-center space-x-2">
            {/* WiFi Signal Icon with Satellite Integration Panel */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSocialFeed(!showSocialFeed)}
                className="text-muted-foreground hover:text-cyan-400 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 9L12 2L23 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 13L12 8L19 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 17L12 14L16 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="20" r="1" fill="currentColor" />
                </svg>
              </Button>
            </div>

            {/* Memory Panel Button - Original "Active" design */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMemoryPanel(!showMemoryPanel)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full transition-colors ${showMemoryPanel
                  ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
                  : 'bg-purple-500/10 border border-purple-500/20 text-muted-foreground hover:text-purple-400'
                  }`}
              >
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium">Active</span>
                <Brain size={12} />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages - Original Layout */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 md:px-4 py-2 md:py-3 relative z-10">
          {/* Messages Container */}
          <div className="max-w-4xl mx-auto h-full flex flex-col justify-end">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg">OLD Chat Interface</p>
                <p className="text-sm">Original design before rebuild</p>
              </div>
            </div>
          </div>
        </div>

        {/* Input Area - Original Style */}
        <div className="border-t border-white/10 p-2 md:p-3 relative z-10 flex-shrink-0 bg-black">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <div className="relative border border-input rounded-lg bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                  <Textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="min-h-[44px] max-h-32 resize-none border-0 bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none"
                    rows={1}
                  />
                </div>
              </div>

              {/* Send button */}
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="h-11 w-11 shrink-0 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50"
              >
                <Send size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
