import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Copy,
  FileText,
  Image,
  Pencil,
  Sparkles,
  User,
} from "lucide-react";

import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";
import type { Message } from "@shared/schema";
import AssistantMarkdown from "./AssistantMarkdown";

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

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image size={12} />;
  if (mimeType.includes("csv") || mimeType.includes("excel")) {
    return <BarChart size={12} />;
  }
  return <FileText size={12} />;
}

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
  const timestamp = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const rowPad = compact ? "py-1" : "py-2";
  const avatarSize = compact ? "h-6 w-6" : "h-7 w-7";

  if (isUser) {
    return (
      <div className={`flex w-full justify-end ${rowPad}`}>
        <div className="flex max-w-[88vw] items-start gap-2 sm:max-w-[76%]">
          <div className="min-w-0 flex-1">
            <div
              className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-3 py-2 text-left text-foreground/95 [overflow-wrap:anywhere] ${bodyClass}`}
            >
              {message.content}
            </div>

            <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-muted-foreground/70">
              {showTimestamp && timestamp ? <span>{timestamp}</span> : null}
              {onCopy ? (
                <button
                  type="button"
                  onClick={() => onCopy(message)}
                  className="inline-flex items-center hover:text-foreground"
                >
                  <Copy size={10} className="mr-0.5" />
                  Copy
                </button>
              ) : null}
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(message)}
                  className="inline-flex items-center hover:text-foreground"
                >
                  <Pencil size={10} className="mr-0.5" />
                  Edit
                </button>
              ) : null}
            </div>

            {attachments.length > 0 ? (
              <div className="mt-2 space-y-1 border-r border-cyan-500/20 pr-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-end gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1"
                  >
                    <Badge
                      variant="outline"
                      className="border-cyan-500/30 px-1 text-[10px] text-cyan-300"
                    >
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </Badge>
                    <span className="truncate text-[11px] text-foreground">
                      {file.name}
                    </span>
                    <span className="text-cyan-400">{getFileIcon(file.mimeType)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div
            className={`mt-0.5 flex ${avatarSize} flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5`}
          >
            <User className="text-white" size={14} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full justify-start ${rowPad}`}>
      <div className="flex w-full max-w-[92vw] min-w-0 items-start gap-2 md:max-w-[94%]">
        <div
          className={`mt-0.5 flex ${avatarSize} flex-shrink-0 items-center justify-center rounded-full border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20`}
        >
          <img src={zLogoPath} alt="Z" className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px]">
            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text font-semibold uppercase tracking-[0.18em] text-transparent">
              ZED
            </span>
            <Sparkles size={9} className="text-purple-300" />
          </div>

          <article
            className={`zed-markdown min-w-0 max-w-none break-words text-foreground/95 [overflow-wrap:anywhere] ${bodyClass}`}
          >
            <AssistantMarkdown content={message.content || ""} />
          </article>

          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
            {showTimestamp && timestamp ? <span>{timestamp}</span> : null}
            {onCopy ? (
              <button
                type="button"
                onClick={() => onCopy(message)}
                className="inline-flex items-center hover:text-foreground"
              >
                <Copy size={10} className="mr-0.5" />
                Copy
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
