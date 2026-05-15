import { Badge } from "@/components/ui/badge";
import { Copy, Pencil, User, FileText, Image, BarChart, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  small: "text-xs leading-5",
  medium: "text-sm leading-6",
  large: "text-base leading-7",
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image size={12} />;
  if (mimeType.includes("csv") || mimeType.includes("excel")) return <BarChart size={12} />;
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
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  const rowPad = compact ? "py-1" : "py-1.5";
  const avatarSize = compact ? "h-6 w-6" : "h-7 w-7";

  if (isUser) {
    // USER → RIGHT side
    return (
      <div className={`flex w-full justify-end ${rowPad}`}>
        <div className="flex max-w-[80%] items-start gap-2 sm:max-w-[72%]">
          <div className="min-w-0 flex-1">
            <div
              className={`inline-block max-w-full whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-3 py-1.5 text-right text-foreground/95 ${bodyClass}`}
            >
              {message.content}
            </div>
            <div className="mt-0.5 flex items-center justify-end gap-2 text-[10px] text-muted-foreground/70">
              {showTimestamp && timestamp ? <span>{timestamp}</span> : null}
              {onCopy && (
                <button type="button" onClick={() => onCopy(message)} className="inline-flex items-center hover:text-foreground">
                  <Copy size={10} className="mr-0.5" />
                  Copy
                </button>
              )}
              {onEdit && (
                <button type="button" onClick={() => onEdit(message)} className="inline-flex items-center hover:text-foreground">
                  <Pencil size={10} className="mr-0.5" />
                  Edit
                </button>
              )}
            </div>

            {attachments.length > 0 && (
              <div className="mt-1.5 space-y-1 border-r border-cyan-500/20 pr-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-end gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1"
                  >
                    <Badge variant="outline" className="border-cyan-500/30 px-1 text-[10px] text-cyan-300">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </Badge>
                    <span className="truncate text-[11px] text-foreground">{file.name}</span>
                    <span className="text-cyan-400">{getFileIcon(file.mimeType)}</span>
                  </div>
                ))}
              </div>
            )}
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

  // ASSISTANT → LEFT side
  return (
    <div className={`flex w-full justify-start ${rowPad}`}>
      <div className="flex max-w-[80%] items-start gap-2 sm:max-w-[72%]">
        <div
          className={`mt-0.5 flex ${avatarSize} flex-shrink-0 items-center justify-center rounded-full border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20`}
        >
          <img src={zLogoPath} alt="Z" className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px]">
            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text font-semibold uppercase tracking-[0.18em] text-transparent">
              ZED
            </span>
            <Sparkles size={9} className="text-purple-300" />
          </div>
          <div
            className={`zed-markdown inline-block max-w-full rounded-2xl rounded-tl-sm bg-white/[0.04] px-3 py-2 text-foreground/95 ${bodyClass}`}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              // Pre-strip literal "<br>" tags the model emits (Lightning's
              // gpt-oss-20b often produces them despite being inside markdown).
              components={{
                p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="my-1.5 list-disc pl-5 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="leading-6">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ className, children, ...props }) => {
                  const isInline = !className?.includes("language-");
                  return isInline ? (
                    <code className="rounded bg-white/10 px-1 py-0.5 text-[0.85em] font-mono" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={`${className || ""} block font-mono text-[0.85em]`} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="my-2 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-2.5 text-[0.85em]">
                    {children}
                  </pre>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 underline-offset-2 hover:underline"
                  >
                    {children}
                  </a>
                ),
                h1: ({ children }) => <h1 className="my-2 text-base font-semibold">{children}</h1>,
                h2: ({ children }) => <h2 className="my-2 text-[15px] font-semibold">{children}</h2>,
                h3: ({ children }) => <h3 className="my-1.5 text-sm font-semibold">{children}</h3>,
                h4: ({ children }) => <h4 className="my-1.5 text-sm font-semibold">{children}</h4>,
                blockquote: ({ children }) => (
                  <blockquote className="my-2 border-l-2 border-purple-500/40 pl-3 text-foreground/80">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-3 border-white/10" />,
                table: ({ children }) => (
                  <div className="my-2 overflow-x-auto">
                    <table className="min-w-full border-collapse text-[0.9em]">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="border-b border-white/15">{children}</thead>,
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => <tr className="border-b border-white/5 last:border-b-0">{children}</tr>,
                th: ({ children }) => (
                  <th className="px-2 py-1.5 text-left text-[0.85em] font-semibold uppercase tracking-wide text-muted-foreground">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-2 py-1.5 align-top text-foreground/90">{children}</td>
                ),
              }}
            >
              {/* Strip literal <br> / <br/> / <br /> tags before parsing — the
                  model emits them inside markdown rows even though markdown
                  newlines / list items would render the same break. */}
              {(message.content || "")
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/&lt;br\s*\/?&gt;/gi, "\n")}
            </ReactMarkdown>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
            {showTimestamp && timestamp ? <span>{timestamp}</span> : null}
            {onCopy && (
              <button type="button" onClick={() => onCopy(message)} className="inline-flex items-center hover:text-foreground">
                <Copy size={10} className="mr-0.5" />
                Copy
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
