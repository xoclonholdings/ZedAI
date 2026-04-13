import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, FileText, Image, BarChart, Sparkles } from "lucide-react";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";
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
      <div className="mx-auto flex max-w-4xl flex-row-reverse items-start space-x-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700">
          <User className="text-white" size={16} />
        </div>
        <div className="max-w-xl flex-1">
          <Card className="zed-glass border-white/20 p-4 md:p-5">
            <div className="max-w-none">
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground md:text-[15px]">{message.content}</p>
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
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl items-start space-x-3">
      <div className="flex-1">
        <Card className="zed-message ml-2 p-4 md:p-5">
          <div className="mb-3 flex items-center space-x-2">
            <img src={zLogoPath} alt="Z" className="h-3.5 w-3.5" />
            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-sm font-semibold tracking-[0.14em] text-transparent">ZED</span>
            <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
              <Sparkles size={10} className="mr-1" />
              Assistant
            </Badge>
          </div>
          
          <div className="max-w-none">
            <p className="whitespace-pre-wrap text-sm leading-6 md:text-[15px]">{message.content}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
