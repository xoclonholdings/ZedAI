import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/UseAuth";

interface ChatHeaderProps {
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

export default function ChatHeader({
  isMobile = false,
  onOpenSidebar,
}: ChatHeaderProps) {
  const { user } = useAuth();
  const compact = !!user?.personalization?.compactMessages;
  const fontSize = (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const titleClass = fontSize === "small" ? "text-base md:text-xl" : fontSize === "large" ? "text-xl md:text-3xl" : "text-lg md:text-2xl";
  const subtitleClass = fontSize === "small" ? "text-[11px] md:text-xs" : fontSize === "large" ? "text-sm md:text-base" : "text-xs md:text-sm";
  return (
    <div className={`flex items-center justify-between border-b border-white/10 zed-glass relative z-10 flex-shrink-0 ${compact ? "p-3 md:p-4" : "p-4 md:p-6"}`}>
      <div className="flex items-center space-x-3">
        {isMobile && onOpenSidebar && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSidebar}
            className={`${compact ? "w-8 h-8" : "w-9 h-9"} zed-button rounded-xl p-0 text-muted-foreground hover:text-foreground`}
          >
            <Menu size={20} />
          </Button>
        )}
        <div>
          <h1 className={`font-black uppercase tracking-[0.24em] ${titleClass}`}>
            <span className="bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              ZED
            </span>
          </h1>
          <p className={`${subtitleClass} text-muted-foreground`}>
            Enhanced AI Assistant
          </p>
        </div>
      </div>

      <div />
    </div>
  );
}
