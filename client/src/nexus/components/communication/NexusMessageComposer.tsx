import { useEffect, useRef } from "react";
import { Paperclip, Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface NexusMessageComposerProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onSend: (message: string) => void;
  readonly onAbort?: () => void;
  readonly isStreaming?: boolean;
  readonly onOpenFileUpload: () => void;
  readonly editModeLabel?: string | null;
  readonly onCancelEdit?: () => void;
  readonly compact?: boolean;
  readonly fontSize?: "small" | "medium" | "large";
}

export function NexusMessageComposer({
  value,
  onValueChange,
  onSend,
  onAbort,
  isStreaming,
  onOpenFileUpload,
  editModeLabel,
  onCancelEdit,
  compact = false,
  fontSize = "medium",
}: NexusMessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const minTextareaHeight = compact ? 32 : 36;
  const maxTextareaHeight = 96;
  const textClass =
    fontSize === "small"
      ? "text-xs leading-5"
      : fontSize === "large"
        ? "text-base leading-6"
        : "text-sm leading-5";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(
      Math.max(textarea.scrollHeight, minTextareaHeight),
      maxTextareaHeight,
    )}px`;
  }, [value, minTextareaHeight]);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !isStreaming;

  function handleSend() {
    if (!canSend) return;
    onSend(trimmed);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="space-y-1.5">
      {editModeLabel ? (
        <div className="flex items-center justify-between rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-1.5 text-xs">
          <span className="text-cyan-200">{editModeLabel}</span>
          {onCancelEdit ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-cyan-300 hover:text-cyan-100"
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/[0.09] bg-black/45 px-2 py-1.5">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask ZAR"
          rows={1}
          style={{ minHeight: minTextareaHeight, maxHeight: maxTextareaHeight }}
          className={`block w-full resize-none overflow-y-auto border-0 bg-transparent px-2 py-1.5 text-left text-white shadow-none outline-none placeholder:text-left placeholder:text-white/35 focus-visible:ring-0 focus-visible:ring-offset-0 ${textClass}`}
          disabled={isStreaming}
          aria-label="Ask ZAR"
        />

        <div className="mt-1 flex w-full items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onOpenFileUpload}
            className="h-8 w-8 shrink-0 rounded-xl text-white/48 hover:bg-white/[0.06] hover:text-cyan-200"
            title="Attach a file"
            aria-label="Attach a file"
          >
            <Paperclip size={15} />
          </Button>

          <div className="flex-1" />

          {isStreaming && onAbort ? (
            <Button
              type="button"
              onClick={onAbort}
              className="h-8 w-8 shrink-0 rounded-xl bg-white/10 p-0 text-white hover:bg-white/20"
              title="Stop generation"
              aria-label="Stop generation"
            >
              <Square size={13} className="fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="h-8 w-8 shrink-0 rounded-xl bg-cyan-300 p-0 text-black hover:bg-cyan-200 disabled:opacity-30"
              title="Send (Enter)"
              aria-label="Send message"
            >
              <Send size={14} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
