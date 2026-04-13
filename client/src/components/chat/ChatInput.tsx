import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="flex items-end gap-2">
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Listening…" : "Type a message…"}
          rows={1}
          className="min-h-[42px] max-h-[120px] resize-none rounded-2xl border-white/10 bg-black/40 pr-3 text-sm leading-6 text-white overflow-y-auto"
          disabled={isLoading}
        />
      </div>

      {speechSupported && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleRecording}
          disabled={isLoading}
          className={`h-10 w-10 flex-shrink-0 rounded-xl p-0 transition-colors ${
            isRecording
              ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
              : "text-muted-foreground hover:text-cyan-400 zed-button"
          }`}
          title={isRecording ? "Stop recording" : "Voice input"}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </Button>
      )}

      <Button
        onClick={handleSend}
        disabled={!input.trim() || !!isLoading}
        className="h-10 w-10 flex-shrink-0 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 p-0 hover:from-purple-700 hover:to-pink-700 disabled:opacity-30"
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Send size={16} />
        )}
      </Button>
    </div>
  );
}
