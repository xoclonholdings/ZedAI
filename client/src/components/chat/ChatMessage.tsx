import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, FileText, Image, BarChart, Sparkles } from "lucide-react";
import type { Message } from "@shared/schema";

interface ChatMessageProps {
  message: Message;
}

type MessageAttachment = {
  mimeType: string;
  name: string;
  size: number;
};

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const attachments = Array.isArray((message.metadata as { attachments?: MessageAttachment[] } | null)?.attachments)
    ? ((message.metadata as { attachments?: MessageAttachment[] }).attachments ?? [])
    : [];

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image size={14} />;
    if (mimeType.includes('csv') || mimeType.includes('excel')) return <BarChart size={14} />;
    return <FileText size={14} />;
  };

  if (isUser) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="border-white/10 bg-black/35 px-4 py-3 shadow-none">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <User size={12} />
            <span>User Input</span>
          </div>
          <div className="max-w-none">
            <p className="whitespace-pre-wrap font-mono text-sm leading-6 text-foreground md:text-[15px]">{message.content}</p>
          </div>

          {attachments.length > 0 && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center space-x-3 rounded-xl bg-white/5 p-2">
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
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="border-purple-500/15 bg-black/45 px-4 py-3 shadow-none">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles size={12} className="text-purple-300" />
          <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text font-semibold text-transparent">
            ZED Assistant
          </span>
        </div>
        
        <div className="max-w-none">
          <p className="whitespace-pre-wrap font-mono text-sm leading-6 md:text-[15px]">{message.content}</p>
        </div>
      </Card>
    </div>
  );
}
