import { Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentTarget, ConversationMode } from "@shared/schema";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";

interface ChatControlsProps {
  currentMode: ConversationMode;
  onModeToggle: (mode: ConversationMode) => void;
  onOpenFileUpload: () => void;
  onOpenVoice: () => void;
  agentTarget: AgentTarget;
  onAgentTargetChange: (target: AgentTarget) => void;
}

export default function ChatControls({
  currentMode,
  onModeToggle,
  onOpenFileUpload,
  onOpenVoice,
  agentTarget,
  onAgentTargetChange,
}: ChatControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
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
        onClick={onOpenVoice}
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

      {currentMode === "agent" && (
        <div className="flex flex-wrap items-center rounded-xl border border-white/10 overflow-hidden zed-glass">
          {[
            { key: "auto", label: "Auto" },
            { key: "operations", label: "Ops" },
            { key: "research", label: "R&D" },
            { key: "business", label: "Biz" },
          ].map((option) => (
            <button
              key={option.key}
              onClick={() => onAgentTargetChange(option.key as AgentTarget)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                agentTarget === option.key
                  ? "bg-white/10 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
