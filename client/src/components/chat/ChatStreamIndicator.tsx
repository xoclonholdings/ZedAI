import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface ChatStreamIndicatorProps {
  streamingMessage?: string;
}

export default function ChatStreamIndicator({
  streamingMessage,
}: ChatStreamIndicatorProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <Card className="zed-glow border-purple-500/15 bg-black/45 px-4 py-3 shadow-none">
        <div className="mb-2 flex items-center gap-2">
          <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-[10px] font-semibold uppercase tracking-[0.22em] text-transparent">
            ZED Assistant
          </span>

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

        <div className="max-w-none">
          {streamingMessage ? (
            <p className="whitespace-pre-wrap font-mono text-sm leading-6 md:text-[15px]">{streamingMessage}</p>
          ) : (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Sparkles size={14} className="animate-pulse" />
              <span>Thinking…</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
