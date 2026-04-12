import { Menu, Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";

interface ChatHeaderProps {
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

export default function ChatHeader({
  isMobile = false,
  onOpenSidebar,
}: ChatHeaderProps) {
  const [, navigate] = useLocation();

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

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin")}
          className="zed-button rounded-xl text-muted-foreground hover:text-foreground"
        >
          <Shield size={16} className="mr-1" />
          <span className="hidden sm:inline">Admin</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin")}
          className="zed-button rounded-xl text-muted-foreground hover:text-foreground"
          title="Open integration setup"
        >
          <Settings size={16} className="mr-1" />
          <span className="hidden sm:inline">Setup</span>
        </Button>
      </div>
    </div>
  );
}
