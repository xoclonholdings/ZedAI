import { Badge } from "@/components/ui/badge";
import { User, FileText, Image, BarChart, Sparkles } from "lucide-react";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";
import type { Message } from "@shared/schema";

interface ChatMessageProps {
  message: Message;
}

type MessageAttachment = {
  name: string;
  mimeType: string;
  size: number;
};

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const attachments = Array.isArray((message.metadata as any)?.attachments)
    ? ((message.metadata as any).attachments as MessageAttachment[])
    : [];

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image size={14} />;
    if (mimeType.includes('csv') || mimeType.includes('excel')) return <BarChart size={14} />;
    return <FileText size={14} />;
  };

  if (isUser) {
    return (
      <div className="flex max-w-4xl flex-row-reverse items-start gap-3 border-b border-white/5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <User className="text-white" size={18} />
        </div>
        <div className="flex-1 space-y-3">
          <div className="text-sm leading-7 text-foreground/95 whitespace-pre-wrap">{message.content}</div>

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
    <div className="max-w-4xl border-b border-white/5 py-4">
      <div className="mb-3 flex items-center gap-2 text-xs">
        <img src={zLogoPath} alt="Z" className="h-3.5 w-3.5" />
        <span className="font-semibold uppercase tracking-[0.18em] bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
          ZED
        </span>
        <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
          <Sparkles size={10} className="mr-1" />
          Assistant
        </Badge>
      </div>

      <div className="pl-5 text-sm leading-7 text-foreground/95 whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  );
}
