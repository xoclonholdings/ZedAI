import { Badge } from "@/components/ui/badge";
import { Copy, Pencil, User, FileText, Image, BarChart, Sparkles } from "lucide-react";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";
import type { Message } from "@shared/schema";

interface ChatMessageProps {
  message: Message;
  onCopy?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  compact?: boolean;
  fontSize?: "small" | "medium" | "large";
  showTimestamp?: boolean;
}

type MessageAttachment = {
  name: string;
  mimeType: string;
  size: number;
};

const FONT_CLASS: Record<NonNullable<ChatMessageProps["fontSize"]>, string> = {
  small: "text-xs leading-6",
  medium: "text-sm leading-7",
  large: "text-base leading-8",
};

export default function ChatMessage({
  message,
  onCopy,
  onEdit,
  compact = false,
  fontSize = "medium",
  showTimestamp = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const attachments = Array.isArray((message.metadata as any)?.attachments)
    ? ((message.metadata as any).attachments as MessageAttachment[])
    : [];
  const bodyClass = FONT_CLASS[fontSize];
  const timestamp = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  const rowPadding = compact ? "py-1.5" : "py-3";
  const metaPadding = compact ? "px-0.5" : "px-1";

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image size={14} />;
    if (mimeType.includes('csv') || mimeType.includes('excel')) return <BarChart size={14} />;
    return <FileText size={14} />;
  };

  if (isUser) {
    return (
      <div className={`flex max-w-4xl items-start gap-3 ${rowPadding}`}>
        <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <User className="text-white" size={18} />
        </div>
        <div className="max-w-[72%] space-y-3">
          <div className={`inline-block max-w-full py-0.5 text-foreground/95 whitespace-pre-wrap ${bodyClass} ${metaPadding}`}>
            {message.content}
          </div>
          <div className={`flex items-center gap-3 text-[11px] text-muted-foreground ${metaPadding}`}>
            {showTimestamp && timestamp ? <span>{timestamp}</span> : null}
            {onCopy && (
              <button type="button" onClick={() => onCopy(message)} className="hover:text-foreground">
                <Copy size={12} className="mr-1 inline" />
                Copy
              </button>
            )}
            {onEdit && (
              <button type="button" onClick={() => onEdit(message)} className="hover:text-foreground">
                <Pencil size={12} className="mr-1 inline" />
                Edit
              </button>
            )}
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2 border-l border-cyan-500/20 pl-3">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-cyan-400">
                    {getFileIcon(file.mimeType)}
                  </div>
                  <span className="truncate text-sm text-foreground">{file.name}</span>
                  <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex max-w-4xl justify-end ${rowPadding}`}>
      <div className="max-w-[72%]">
        <div className="mb-2 flex items-center justify-end gap-2 text-xs">
          <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
            <Sparkles size={10} className="mr-1" />
            Assistant
          </Badge>
          <span className="font-semibold uppercase tracking-[0.18em] bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            ZED
          </span>
          <img src={zLogoPath} alt="Z" className="h-3.5 w-3.5" />
        </div>

        <div className={`ml-auto inline-block max-w-full py-0.5 text-foreground/95 whitespace-pre-wrap ${bodyClass} ${metaPadding}`}>
          {message.content}
        </div>
        <div className={`flex items-center justify-end gap-3 text-[11px] text-muted-foreground ${metaPadding}`}>
          {showTimestamp && timestamp ? <span>{timestamp}</span> : null}
          {onCopy && (
            <button type="button" onClick={() => onCopy(message)} className="hover:text-foreground">
              <Copy size={12} className="mr-1 inline" />
              Copy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
