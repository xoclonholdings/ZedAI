import { Rss, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import zLogoPath from "@assets/IMG_2227_1753477194826.png";

interface ChatHeaderProps {
  showSocialFeed: boolean;
  onToggleSocialFeed: () => void;
}

export default function ChatHeader({
  showSocialFeed,
  onToggleSocialFeed,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 zed-glass relative z-10 flex-shrink-0">
      <div className="flex items-center space-x-3">
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

      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSocialFeed}
          className={`zed-button rounded-xl btn-touch ${
            showSocialFeed ? "text-purple-400" : "text-muted-foreground"
          }`}
        >
          <Rss size={16} />
        </Button>

        <Badge
          variant="secondary"
          className="zed-glass border-purple-500/20 text-purple-300"
        >
          <Sparkles size={12} className="mr-1" />
          Active
        </Badge>
      </div>
    </div>
  );
}