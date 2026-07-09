import { Badge } from "@/components/ui/badge";
import { BarChart, Copy, FileText, Image, Pencil } from "lucide-react";

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
  small: "text-[13px] leading-6",
  medium: "text-[14.5px] leading-[1.65]",
  large: "text-base leading-8",
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image size={11} />;
  if (mimeType.includes("csv") || mimeType.includes("excel")) {
    return <BarChart size={11} />;
  }
  return <FileText size={11} />;
}

/**
 * Chat message — operator layout, not chatbot bubbles.
 *
 * User turns: right-aligned text with a subtle rail on the right.
 * ZED turns: left-aligned text with a small cyan rail on the left.
 * No avatars, no name badges, no gradient bubbles. The message IS
 * the message — chrome shows up on hover only.
 */
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
  const rowGap = compact ? "py-1.5" : "py-2.5";
  const isClarifying = Boolean((message.metadata as any)?.clarifyingQuestion);

  if (isUser) {
    return (
      <div className={`group flex w-full justify-end ${rowGap}`}>
        <div className="min-w-0 max-w-[88vw] sm:max-w-[70%]">
          <div className="flex items-start gap-2 justify-end">
            <div
              className={`min-w-0 whitespace-pre-wrap break-words text-right text-foreground [overflow-wrap:anywhere] ${bodyClass}`}
            >
              {message.content}
            </div>
            <div className="mt-1 h-full min-h-[1.25rem] w-[2px] shrink-0 rounded-full bg-white/15" />
          </div>

          <div className="mt-1 flex items-center justify-end gap-2 text-[10.5px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
            {showTimestamp && timestamp ? <span>{timestamp}</span> : null}
            {onCopy ? (
              <button
                type="button"
                onClick={() => onCopy(message)}
                className="inline-flex items-center hover:text-white/70"
              >
                <Copy size={10} className="mr-0.5" />
                Copy
              </button>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(message)}
                className="inline-flex items-center hover:text-white/70"
              >
                <Pencil size={10} className="mr-0.5" />
                Edit
              </button>
            ) : null}
          </div>

          {attachments.length > 0 ? (
            <div className="mt-2 flex flex-wrap justify-end gap-1.5">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px]"
                >
                  <span className="text-cyan-300/70">{getFileIcon(file.mimeType)}</span>
                  <span className="truncate text-white/75 max-w-[24ch]">{file.name}</span>
                  <Badge
                    variant="outline"
                    className="border-white/10 bg-transparent px-1 text-[9px] text-white/45"
                  >
                    {(file.size / 1024 / 1024).toFixed(1)}M
                  </Badge>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex w-full justify-start ${rowGap}`}>
      <div className="flex w-full min-w-0 items-start gap-2 max-w-[94%]">
        <div
          className={`mt-1 h-full min-h-[1.25rem] w-[2px] shrink-0 rounded-full ${
            isClarifying ? "bg-cyan-400" : "bg-cyan-400/40"
          }`}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          {isClarifying && (
            <div className="mb-1 inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-1.5 py-[1px] text-[9.5px] font-medium uppercase tracking-[0.12em] text-cyan-200/85">
              Question
            </div>
          )}

          <article
            className={`zed-markdown min-w-0 max-w-none break-words text-foreground [overflow-wrap:anywhere] ${bodyClass}`}
          >
            <AssistantMarkdown content={message.content || ""} />
          </article>

          <div className="mt-1 flex items-center gap-2 text-[10.5px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
            {showTimestamp && timestamp ? <span>{timestamp}</span> : null}
            {onCopy ? (
              <button
                type="button"
                onClick={() => onCopy(message)}
                className="inline-flex items-center hover:text-white/70"
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
