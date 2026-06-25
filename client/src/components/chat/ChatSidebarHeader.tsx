import { X, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/UseAuth";

interface ChatSidebarHeaderProps {
  isMobile?: boolean;
  isCreating?: boolean;
  onCreateConversation: () => void;
  onClose?: () => void;
  onCollapse: () => void;
}

export default function ChatSidebarHeader({
  isMobile = false,
  isCreating = false,
  onCreateConversation,
  onClose,
  onCollapse,
}: ChatSidebarHeaderProps) {
  const { user } = useAuth();
  const compact = !!user?.personalization?.compactMessages;
  const fontSize = (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const titleClass = fontSize === "small" ? "text-base" : fontSize === "large" ? "text-xl" : "text-lg";
  const subtitleClass = fontSize === "small" ? "text-[10px]" : fontSize === "large" ? "text-xs" : "text-[11px]";
  return (
    <div className={`relative z-10 border-b border-white/10 ${compact ? "p-3" : "p-4"}`}>
      <div className={`${compact ? "mb-3" : "mb-4"} flex items-center justify-between`}>
        <div className="flex items-center space-x-3">
          <div>
            <h2 className={`${titleClass} font-black uppercase tracking-[0.22em]`}>
              <span className="bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                ZED
              </span>
            </h2>
            <p className={`${subtitleClass} text-muted-foreground`}>
              Enhanced AI Assistant
            </p>
          </div>
        </div>

        <Button
          onClick={isMobile ? onClose : onCollapse}
          variant="ghost"
          size="sm"
          className={`${compact ? "w-7 h-7" : "w-8 h-8"} zed-button rounded-xl p-0 text-muted-foreground hover:text-foreground`}
          aria-label="Close sidebar"
        >
          <X size={16} />
        </Button>
      </div>

      <Button
        onClick={onCreateConversation}
        disabled={isCreating}
        className={`w-full rounded-xl ${compact ? "p-2.5 text-xs" : "p-3 text-sm"} font-medium text-white transition-all duration-300 zed-gradient hover:zed-gradient-hover`}
      >
        <div className="flex items-center justify-center space-x-2">
          <Plus size={16} />
          <span>New Conversation</span>
          <Sparkles size={12} className="text-cyan-300" />
        </div>
      </Button>
    </div>
  );
}
