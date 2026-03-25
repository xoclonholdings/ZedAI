import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, FileText, Image, BarChart, Sparkles } from "lucide-react";
import zLogoPath from "@assets/IMG_2227_1753477194826.png";
import type { Message } from "@shared/schema";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image size={14} />;
    if (mimeType.includes('csv') || mimeType.includes('excel')) return <BarChart size={14} />;
    return <FileText size={14} />;
  };

  if (isUser) {
    return (
      <div className="flex items-start space-x-4 flex-row-reverse max-w-4xl mx-auto">
        <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl flex items-center justify-center flex-shrink-0">
          <User className="text-white" size={18} />
        </div>
        <div className="flex-1 max-w-2xl">
          <Card className="zed-glass border-white/20 p-6">
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-foreground leading-relaxed">{message.content}</p>
            </div>
            
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="space-y-2">
                  {message.attachments.map((file, index) => (
                    <div key={index} className="flex items-center space-x-3 p-2 rounded-xl bg-white/5">
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
    <div className="flex items-start space-x-4 max-w-4xl mx-auto">
      <div className="flex-1">
        <Card className="zed-message p-6 ml-4">
          <div className="flex items-center space-x-2 mb-4">
            <img src={zLogoPath} alt="Z" className="w-4 h-4" />
            <span className="text-lg font-semibold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
            <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
              <Sparkles size={10} className="mr-1" />
              Assistant
            </Badge>
          </div>
          
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}