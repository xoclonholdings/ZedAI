import { useEffect, useRef } from "react";
import { Mic, MicOff, Paperclip, Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth/UseAuth";

import { useDictation } from "./chat-composer/useDictation";

interface ChatComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (message: string) => void;
  onAbort?: () => void;

  isStreaming?: boolean;

  onOpenFileUpload: () => void;

  editModeLabel?: string | null;
  onCancelEdit?: () => void;
}

export default function ChatComposer({
  value,
  onValueChange,
  onSend,
  onAbort,
  isStreaming,
  onOpenFileUpload,
  editModeLabel,
  onCancelEdit,
}: ChatComposerProps) {
  const { user } = useAuth();
  const compact = !!user?.personalization?.compactMessages;
  const fontSize =
    (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const textClass =
    fontSize === "small"
      ? "text-xs leading-5"
      : fontSize === "large"
        ? "text-base leading-6"
        : "text-sm leading-5";

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation(onValueChange);
  const minTextareaHeight = compact ? 32 : 36;
  const maxTextareaHeight = 96;

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, minTextareaHeight), maxTextareaHeight)}px`;
  }, [value, minTextareaHeight]);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !isStreaming;

  function handleSend() {
    if (!canSend) return;
    onSend(trimmed);
    onValueChange("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="space-y-1.5">
      {editModeLabel && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-400/20 bg-cyan-500/5 px-3 py-1.5 text-xs">
          <span className="text-cyan-200">{editModeLabel}</span>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-cyan-300 hover:text-cyan-100"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-black/40 px-2 py-1.5">
        <div className="min-w-0">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={dictation.isDictating ? "Listening..." : "Message Zed"}
            rows={1}
            style={{ minHeight: minTextareaHeight, maxHeight: maxTextareaHeight }}
            className={`block w-full resize-none overflow-y-auto border-0 bg-transparent px-2 py-1.5 text-left shadow-none outline-none placeholder:text-left focus-visible:ring-0 focus-visible:ring-offset-0 ${textClass}`}
            disabled={isStreaming}
          />
        </div>

        <div className="mt-1 flex w-full items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onOpenFileUpload}
            className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:text-purple-300"
            title="Attach a file"
            aria-label="Attach a file"
          >
            <Paperclip size={15} />
          </Button>

          <div className="flex-1" />

          {dictation.speechSupported && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={dictation.toggle}
              disabled={isStreaming}
              title={dictation.isDictating ? "Stop dictation" : "Dictate"}
              aria-label={dictation.isDictating ? "Stop dictation" : "Dictate"}
              className={`h-8 w-8 shrink-0 rounded-xl ${
                dictation.isDictating
                  ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                  : "text-muted-foreground hover:bg-white/5 hover:text-cyan-300"
              } disabled:pointer-events-none disabled:opacity-40`}
            >
              {dictation.isDictating ? <MicOff size={14} /> : <Mic size={14} />}
            </Button>
          )}

          {isStreaming && onAbort ? (
            <Button
              type="button"
              onClick={onAbort}
              className="h-8 w-8 shrink-0 rounded-xl bg-white/10 p-0 text-foreground hover:bg-white/20"
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
              className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 p-0 hover:from-purple-700 hover:to-pink-700 disabled:opacity-30"
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
