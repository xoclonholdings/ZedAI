import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth/UseAuth";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  editModeLabel?: string | null;
  onCancelEdit?: () => void;
}

export default function ChatInput({ onSend, isLoading, value, onValueChange, editModeLabel, onCancelEdit }: ChatInputProps) {
  const { user } = useAuth();
  const [internalInput, setInternalInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const input = value ?? internalInput;
  const setInput = onValueChange ?? setInternalInput;
  const compact = !!user?.personalization?.compactMessages;
  const fontSize = (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const textClass =
    fontSize === "small" ? "text-xs leading-5" : fontSize === "large" ? "text-base leading-7" : "text-sm leading-6";

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    if (!speechSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  return (
    <div className="space-y-2">
      {editModeLabel && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{editModeLabel}</span>
          {onCancelEdit && (
            <button type="button" onClick={onCancelEdit} className="text-cyan-300 hover:text-cyan-200">
              Cancel
            </button>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening…" : "Type a message…"}
            rows={1}
            className={`max-h-[120px] resize-none rounded-2xl border-white/10 bg-black/40 text-white overflow-y-auto ${
              speechSupported ? "pr-11" : "pr-3"
            } ${compact ? "min-h-[38px] py-2" : "min-h-[42px] py-2.5"} ${textClass}`}
            disabled={isLoading}
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isLoading}
              title={isRecording ? "Stop recording" : "Dictate"}
              aria-label={isRecording ? "Stop recording" : "Dictate"}
              className={`absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                isRecording
                  ? "text-red-400 bg-red-500/15 hover:bg-red-500/25"
                  : "text-muted-foreground hover:text-cyan-400 hover:bg-white/5"
              } disabled:opacity-40 disabled:pointer-events-none`}
            >
              {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
        </div>

        <Button
          onClick={handleSend}
          disabled={!input.trim() || !!isLoading}
          className={`${compact ? "h-9 w-9" : "h-10 w-10"} flex-shrink-0 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 p-0 hover:from-purple-700 hover:to-pink-700 disabled:opacity-30`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </Button>
      </div>
    </div>
  );
}
