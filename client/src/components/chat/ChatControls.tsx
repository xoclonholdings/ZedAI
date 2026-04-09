import { MessageSquare, Mic, Paperclip, Settings, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ConversationMode } from "@shared/schema";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";

interface ChatControlsProps {
  currentMode: ConversationMode;
  filesCount: number;
  onOpenFileUpload: () => void;
  onToggleModeSelector: () => void;
}

export default function ChatControls({
  currentMode,
  filesCount,
  onOpenFileUpload,
  onToggleModeSelector,
}: ChatControlsProps) {
  return (
    <div className="flex items-center justify-between mb-3">
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

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleModeSelector}
          className="zed-button text-muted-foreground hover:text-cyan-400 h-auto px-3 py-2 rounded-xl flex items-center space-x-1 btn-touch"
        >
          {currentMode === "chat" ? (
            <MessageSquare size={14} />
          ) : (
            <img src={zLogoPath} alt="Z" className="w-3.5 h-3.5" />
          )}

          <span className="text-xs capitalize">{currentMode}</span>
          <Settings size={10} />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground flex items-center">
        <Sparkles size={12} className="mr-1 text-purple-400" />
        {filesCount} file{filesCount === 1 ? "" : "s"} attached
      </div>
    </div>
  );
}