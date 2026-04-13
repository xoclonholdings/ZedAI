import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";

interface ChatStreamIndicatorProps {
  streamingMessage?: string;
}

export default function ChatStreamIndicator({
  streamingMessage,
}: ChatStreamIndicatorProps) {
  return (
    <div className="max-w-4xl border-b border-white/5 py-4">
      <div className="mb-3 flex items-center gap-2 text-xs">
        <img src={zLogoPath} alt="Z" className="h-3.5 w-3.5" />
        <span className="font-semibold uppercase tracking-[0.18em] bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
          ZED
        </span>
        <Badge
          variant="outline"
          className="text-[10px] border-purple-500/30 text-purple-300"
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

      <div className="pl-5 text-sm leading-7 text-foreground/95">
        {streamingMessage ? (
          <div className="whitespace-pre-wrap">{streamingMessage}</div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles size={16} className="animate-pulse" />
            <span>Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}
