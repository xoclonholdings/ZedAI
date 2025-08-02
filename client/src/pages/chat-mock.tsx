import { useState } from "react";
import { useChatWithFallback } from "@/hooks/use-chat-with-fallback";
import { useAuthMock } from "@/hooks/useAuthMock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { LogOut, Send, Trash2 } from "lucide-react";

export default function ChatMock() {
  const [input, setInput] = useState("");
  const chat = useChatWithFallback();
  const mockAuth = useAuthMock();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chat.isStreaming) return;
    
    await chat.sendMessage(input);
    setInput("");
  };

  const handleLogout = () => {
    mockAuth.logout();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
            ZED AI Assistant
          </h1>
          {chat.isMockMode && (
            <p className="text-sm text-yellow-400">Running in Mock Mode</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={chat.clearMessages}
            variant="outline"
            size="sm"
            className="border-gray-600 hover:bg-gray-800"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="border-gray-600 hover:bg-gray-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chat.messages.map((message) => (
          <Card
            key={message.id}
            className={`p-4 max-w-4xl ${
              ('role' in message ? message.role === 'user' : message.isUser)
                ? "ml-auto bg-blue-900/50 border-blue-800"
                : "mr-auto bg-gray-900/50 border-gray-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                ('role' in message ? message.role === 'user' : message.isUser)
                  ? "bg-blue-600 text-white"
                  : "bg-gradient-to-r from-purple-500 to-cyan-500 text-white"
              }`}>
                {('role' in message ? message.role === 'user' : message.isUser) ? "U" : "Z"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">
                    {('role' in message ? message.role === 'user' : message.isUser) ? "You" : "ZED"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  {message.source && (
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                      {message.source}
                    </span>
                  )}
                </div>
                <div className="text-gray-100 whitespace-pre-wrap">
                  {'content' in message ? message.content : message.message}
                </div>
              </div>
            </div>
          </Card>
        ))}
        
        {chat.isStreaming && (
          <Card className="p-4 max-w-4xl mr-auto bg-gray-900/50 border-gray-700">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center text-sm font-medium text-white">
                Z
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">ZED</span>
                  <span className="text-xs text-gray-500">typing...</span>
                </div>
                <div className="text-gray-100">
                  <div className="animate-pulse">●●●</div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message ZED..."
            className="flex-1 bg-gray-900 border-gray-700 text-white placeholder-gray-400"
            disabled={chat.isStreaming}
          />
          <Button
            type="submit"
            disabled={!input.trim() || chat.isStreaming}
            className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
