import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Mic, MessageSquare } from "lucide-react";

// Simple test version of ChatArea - rebuilding piece by piece
export default function TestChatArea() {
    const [inputValue, setInputValue] = useState("");

    const handleSend = () => {
        if (!inputValue.trim()) return;
        console.log("Test message:", inputValue);
        setInputValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-900/40 border border-white/20 rounded-lg overflow-hidden">
            {/* Clean Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-800/50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center">
                        <MessageSquare size={16} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white">ZED Chat Interface</h3>
                        <p className="text-xs text-gray-400">Test Build - Main Chat Only</p>
                    </div>
                </div>

                {/* Memory Button as requested */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-purple-400 hover:text-purple-300 border border-purple-500/30 hover:bg-purple-500/10"
                >
                    Memory
                </Button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                    {/* Welcome Message */}
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                            <MessageSquare size={24} className="text-white" />
                        </div>
                        <h2 className="text-lg font-semibold text-white mb-2">ZED Main Chat Interface</h2>
                        <p className="text-gray-400 text-sm">
                            Clean rebuild - Start your conversation below
                        </p>
                    </div>

                    {/* Test Message */}
                    <div className="bg-gray-800/50 border border-white/10 rounded-lg p-3 max-w-md">
                        <p className="text-gray-300 text-sm">
                            This is the clean main chat interface.
                            Type a message below to test the input.
                        </p>
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-gray-800/30">
                <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                        <Textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message..."
                            className="min-h-[44px] max-h-32 resize-none bg-gray-800/50 border-white/20 text-white placeholder:text-gray-400 focus:border-purple-500/50"
                            rows={1}
                        />
                    </div>

                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-11 w-11 text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <Paperclip size={18} />
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-11 w-11 text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <Mic size={18} />
                        </Button>

                        <Button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="h-11 w-11 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50"
                        >
                            <Send size={18} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
