import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Mic, MicOff, Paperclip, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth/UseAuth";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";
import type { AgentTarget, ConversationMode } from "@shared/schema";

interface ChatComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (message: string) => void;
  onAbort?: () => void;

  isStreaming?: boolean;

  currentMode: ConversationMode;
  onModeChange: (mode: ConversationMode) => void;

  agentTarget: AgentTarget;
  onAgentTargetChange: (target: AgentTarget) => void;

  onOpenFileUpload: () => void;

  editModeLabel?: string | null;
  onCancelEdit?: () => void;
}

type LaneOption = {
  key: "chat" | AgentTarget;
  mode: ConversationMode;
  agent?: AgentTarget;
  label: string;
  blurb: string;
};

const LANE_OPTIONS: LaneOption[] = [
  { key: "chat", mode: "chat", label: "Chat", blurb: "Direct conversation, no orchestration." },
  {
    key: "operations",
    mode: "agent",
    agent: "operations",
    label: "Operations",
    blurb: "Day-to-day ops, scheduling, routing.",
  },
  {
    key: "research",
    mode: "agent",
    agent: "research",
    label: "R&D",
    blurb: "Research, intelligence, synthesis.",
  },
  {
    key: "business",
    mode: "agent",
    agent: "business",
    label: "Business",
    blurb: "Commerce, property, planning.",
  },
  {
    key: "finance",
    mode: "agent",
    agent: "finance",
    label: "Finance",
    blurb: "Money, payroll, markets.",
  },
];

export default function ChatComposer({
  value,
  onValueChange,
  onSend,
  onAbort,
  isStreaming,
  currentMode,
  onModeChange,
  agentTarget,
  onAgentTargetChange,
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
        ? "text-base leading-7"
        : "text-sm leading-6";

  const [isDictating, setIsDictating] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showLanePicker, setShowLanePicker] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lanePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [value]);

  // Close lane picker when clicking outside
  useEffect(() => {
    if (!showLanePicker) return;
    const handler = (e: MouseEvent) => {
      if (!lanePickerRef.current?.contains(e.target as Node)) {
        setShowLanePicker(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showLanePicker]);

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

  function toggleDictation() {
    if (!speechSupported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (isDictating) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsDictating(false);
      return;
    }
    const recog = new SR();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = "en-US";
    recog.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      onValueChange(transcript);
    };
    recog.onend = () => setIsDictating(false);
    recog.onerror = () => setIsDictating(false);
    recognitionRef.current = recog;
    recog.start();
    setIsDictating(true);
  }

  const activeLane =
    currentMode === "chat"
      ? LANE_OPTIONS[0]
      : LANE_OPTIONS.find((l) => l.agent === agentTarget) || LANE_OPTIONS[1];

  function pickLane(opt: LaneOption) {
    if (opt.mode !== currentMode) onModeChange(opt.mode);
    if (opt.mode === "agent" && opt.agent) onAgentTargetChange(opt.agent);
    setShowLanePicker(false);
    textareaRef.current?.focus();
  }

  return (
    <div className="space-y-2">
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

      <div
        className={`flex items-end gap-2 rounded-2xl border border-white/10 bg-black/40 ${
          compact ? "px-2 py-1.5" : "px-2.5 py-2"
        }`}
      >
        {/* Attach */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenFileUpload}
          className="h-9 w-9 shrink-0 self-end rounded-xl text-muted-foreground hover:text-purple-300"
          title="Attach a file"
          aria-label="Attach a file"
        >
          <Paperclip size={16} />
        </Button>

        {/* Lane chip */}
        <div ref={lanePickerRef} className="relative shrink-0 self-end">
          <button
            type="button"
            onClick={() => setShowLanePicker((v) => !v)}
            className={`flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-medium transition-colors ${
              currentMode === "agent"
                ? "bg-purple-500/15 text-purple-100 hover:bg-purple-500/25"
                : "bg-white/5 text-foreground hover:bg-white/10"
            }`}
            aria-haspopup="menu"
            aria-expanded={showLanePicker}
            data-testid="composer-lane-chip"
          >
            {currentMode === "agent" && (
              <img src={zLogoPath} alt="" className="h-3 w-3" />
            )}
            <span className="whitespace-nowrap">
              {currentMode === "agent" ? `Agent · ${activeLane.label}` : "Chat"}
            </span>
            <ChevronDown size={12} className="opacity-70" />
          </button>

          {showLanePicker && (
            <div
              role="menu"
              className="absolute bottom-full left-0 z-30 mb-2 w-60 rounded-xl border border-white/10 bg-black/95 p-1 shadow-2xl backdrop-blur"
            >
              {LANE_OPTIONS.map((opt) => {
                const isActive =
                  (opt.mode === "chat" && currentMode === "chat") ||
                  (opt.mode === "agent" &&
                    currentMode === "agent" &&
                    opt.agent === agentTarget);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => pickLane(opt)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      isActive ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
                        isActive
                          ? "border-cyan-400/60 bg-cyan-400/20"
                          : "border-white/15 bg-transparent"
                      }`}
                    >
                      {isActive && (
                        <Check size={10} className="m-auto mt-0.5 text-cyan-200" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground">
                        {opt.mode === "agent" ? `Agent · ${opt.label}` : opt.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {opt.blurb}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Textarea + inline dictate mic */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isDictating ? "Listening…" : "Message Zed"}
            rows={1}
            className={`max-h-[140px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
              speechSupported ? "pr-9" : "pr-2"
            } ${compact ? "min-h-[36px] py-1.5" : "min-h-[40px] py-2"} ${textClass}`}
            disabled={isStreaming}
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleDictation}
              disabled={isStreaming}
              title={isDictating ? "Stop dictation" : "Dictate"}
              aria-label={isDictating ? "Stop dictation" : "Dictate"}
              className={`absolute right-1 bottom-1.5 flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                isDictating
                  ? "text-red-300 bg-red-500/15 hover:bg-red-500/25"
                  : "text-muted-foreground hover:text-cyan-300 hover:bg-white/5"
              } disabled:opacity-40 disabled:pointer-events-none`}
            >
              {isDictating ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          )}
        </div>

        {/* Send / Stop */}
        {isStreaming && onAbort ? (
          <Button
            type="button"
            onClick={onAbort}
            className="h-9 w-9 shrink-0 self-end rounded-xl bg-white/10 p-0 text-foreground hover:bg-white/20"
            title="Stop generation"
            aria-label="Stop generation"
          >
            <Square size={14} className="fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="h-9 w-9 shrink-0 self-end rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 p-0 hover:from-purple-700 hover:to-pink-700 disabled:opacity-30"
            title="Send (Enter)"
            aria-label="Send message"
          >
            <Send size={15} />
          </Button>
        )}
      </div>
    </div>
  );
}
