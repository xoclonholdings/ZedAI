import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import zLogoPath from "@assets/IMG_2227_1753477194826.png";

interface ChatStreamIndicatorProps {
  streamingMessage?: string;
}

export default function ChatStreamIndicator({
  streamingMessage,
}: ChatStreamIndicatorProps) {
  return (
    <div className="flex items-start space-x-4 max-w-4xl mx-auto">
      <Card className="flex-1 p-4 md:p-6 zed-message zed-glow ml-4">
        <div className="flex items-center space-x-2 mb-4">
          <div className="flex items-center space-x-2">
            <img src={zLogoPath} alt="Z" className="w-4 h-4" />
            <span className="text-lg font-semibold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              ZED
            </span>
          </div>

          <Badge
            variant="outline"
            className="text-xs border-purple-500/30 text-purple-300"
          >
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-purple-400 rounded-full zed-typing" />
              <div
                className="w-2 h-2 bg-cyan-400 rounded-full zed-typing"
                style={{ animationDelay: "0.3s" }}
              />
              <div
                className="w-2 h-2 bg-pink-400 rounded-full zed-typing"
                style={{ animationDelay: "0.6s" }}
              />
            </div>
          </Badge>
        </div>

        <div className="prose prose-sm max-w-none">
          {streamingMessage ? (
            <p className="whitespace-pre-wrap">{streamingMessage}</p>
          ) : (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Sparkles size={16} className="animate-pulse" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}