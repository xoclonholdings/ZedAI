import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";
import zLogoPath from "@assets/IMG_2227_1753477194826.png";

export default function ChatEmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md p-6 zed-message zed-morph-border text-center">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <img src={zLogoPath} alt="Z" className="w-6 h-6" />
          <span className="text-xl font-semibold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            ZED
          </span>
          <Badge
            variant="outline"
            className="text-xs border-purple-500/30 text-purple-300"
          >
            AI Assistant
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Enhanced AI assistant ready to help with any task
        </p>

        <div className="mt-4 text-xs text-muted-foreground/70 flex items-center justify-center">
          <Zap size={12} className="mr-1 text-cyan-400" />
          Start typing to begin
        </div>
      </Card>
    </div>
  );
}