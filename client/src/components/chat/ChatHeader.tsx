import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";

interface ChatHeaderProps {
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

export default function ChatHeader({
  isMobile = false,
  onOpenSidebar,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 zed-glass relative z-10 flex-shrink-0">
      <div className="flex items-center space-x-3">
        {isMobile && onOpenSidebar && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSidebar}
            className="w-9 h-9 zed-button rounded-xl p-0 text-muted-foreground hover:text-foreground"
          >
            <Menu size={20} />
          </Button>
        )}
        <div>
          <h1 className="text-lg md:text-xl font-bold flex items-center space-x-2">
            <img src={zLogoPath} alt="Z" className="w-4 h-4 md:w-5 md:h-5" />
            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              ZED
            </span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Enhanced AI Assistant
          </p>
        </div>
      </div>

      <div />
    </div>
  );
}
