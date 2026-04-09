import { X, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import LogoutButton from "@/components/auth/LogoutButton";
import SettingsModal from "@/components/settings/SettingsModal";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";

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
  return (
    <div className="p-6 border-b border-white/10 relative z-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div>
            <h2 className="text-xl font-bold flex items-center space-x-2">
              <img src={zLogoPath} alt="Z" className="w-5 h-5" />
              <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                ZED
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Enhanced AI Assistant
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <LogoutButton />

          <Button
            onClick={isMobile ? onClose : onCollapse}
            variant="ghost"
            size="sm"
            className="w-8 h-8 zed-button rounded-xl p-0 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <Button
        onClick={onCreateConversation}
        disabled={isCreating}
        className="w-full zed-gradient hover:zed-gradient-hover rounded-xl p-4 text-white font-medium transition-all duration-300"
      >
        <div className="flex items-center justify-center space-x-2">
          <Plus size={18} />
          <span>New Conversation</span>
          <Sparkles size={14} className="text-cyan-300" />
        </div>
      </Button>

      <div className="mt-4 space-y-2">
        <SettingsModal />
      </div>
    </div>
  );
}