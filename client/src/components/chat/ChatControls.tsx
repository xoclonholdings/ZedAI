import { Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConversationMode } from "@shared/schema";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";

interface ChatControlsProps {
  currentMode: ConversationMode;
  onModeToggle: (mode: ConversationMode) => void;
  onOpenFileUpload: () => void;
}

export default function ChatControls({
  currentMode,
  onModeToggle,
  onOpenFileUpload,
}: ChatControlsProps) {
  return (
    <div className="flex items-center space-x-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenFileUpload}
        className="zed-button text-muted-foreground hover:text-purple-400 h-auto p-2 rounded-xl btn-touch"
      >
        <Paperclip size={18} />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="zed-button text-muted-foreground hover:text-cyan-400 h-auto p-2 rounded-xl btn-touch"
      >
        <Mic size={18} />
      </Button>

      {/* Mode flip pill */}
      <div className="flex items-center rounded-xl border border-white/10 overflow-hidden zed-glass">
        <button
          onClick={() => onModeToggle("chat")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center space-x-1 ${
            currentMode === "chat"
              ? "bg-white/10 text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Chat</span>
        </button>
        <div className="w-px h-4 bg-white/10" />
        <button
          onClick={() => onModeToggle("agent")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center space-x-1.5 ${
            currentMode === "agent"
              ? "bg-white/10 text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <img src={zLogoPath} alt="" className="w-3 h-3" />
          <span>Agent</span>
        </button>
      </div>
    </div>
  );
}
