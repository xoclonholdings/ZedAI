import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentTarget, ConversationMode } from "@shared/schema";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";
import { useToast } from "@/hooks/use-toast";

interface ChatControlsProps {
  currentMode: ConversationMode;
  onModeToggle: (mode: ConversationMode) => void;
  onOpenFileUpload: () => void;
  agentTarget: AgentTarget;
  onAgentTargetChange: (target: AgentTarget) => void;
  /** Optional: when supplied, voice-command results are linked back to this conversation. */
  conversationId?: string | null;
  /** Optional: stable speaker id for the voice intake event. */
  speakerId?: string;
}

export default function ChatControls({
  currentMode,
  onModeToggle,
  onOpenFileUpload,
  agentTarget,
  onAgentTargetChange,
  conversationId,
  speakerId,
}: ChatControlsProps) {
  const { toast } = useToast();
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognition);
  }, []);

  const submitTranscript = async (transcript: string) => {
    if (!transcript.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/intake/voice", {
        method: "POST",
        body: JSON.stringify({
          transcript: transcript.trim(),
          speaker_id: speakerId || "browser-voice",
          confidence: 0.9,
          metadata: { conversation_id: conversationId || null, agent_target: agentTarget },
        }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok || data.status === "stubbed") {
        throw new Error(data.reason || "Voice command failed");
      }
      const task = data?.gateway_result?.task;
      const plan = data?.gateway_result?.plan;
      const approval = task?.approval_status as string | undefined;
      const summary = plan?.summary || "Voice command captured";
      const approvalLabel =
        approval === "user_required"
          ? "Awaiting your approval"
          : approval === "admin_required"
            ? "Awaiting admin approval"
            : approval === "manual_handling_required"
              ? "Marked for manual handling"
              : "Routed";
      toast({
        title: "Voice command routed",
        description: `${summary}\n${approvalLabel}.`,
      });
    } catch (err: any) {
      toast({
        title: "Voice command failed",
        description: err?.message || "Unable to route the voice command.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stopCapture = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
  };

  const toggleVoiceCommand = () => {
    if (!voiceSupported || isSubmitting) return;
    if (isCapturing) {
      stopCapture();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    transcriptRef.current = "";

    recognition.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      transcriptRef.current = text;
    };

    recognition.onend = () => {
      setIsCapturing(false);
      const finalTranscript = transcriptRef.current;
      transcriptRef.current = "";
      if (finalTranscript.trim()) {
        void submitTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      setIsCapturing(false);
      transcriptRef.current = "";
      if (event?.error && event.error !== "aborted" && event.error !== "no-speech") {
        toast({
          title: "Microphone error",
          description: String(event.error),
          variant: "destructive",
        });
      }
    };

    recognitionRef.current = recognition;
    setIsCapturing(true);
    recognition.start();
  };

  const voiceTooltip = !voiceSupported
    ? "Voice commands require a browser that supports the Web Speech API"
    : isSubmitting
      ? "Routing voice command…"
      : isCapturing
        ? "Stop and route command"
        : "Voice command — speak a request, Zed plans and queues it";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenFileUpload}
        className="zed-button text-muted-foreground hover:text-purple-400 h-auto p-2 rounded-xl btn-touch"
        title="Attach a file"
        aria-label="Attach a file"
      >
        <Paperclip size={18} />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={toggleVoiceCommand}
        disabled={!voiceSupported || isSubmitting}
        className={`zed-button h-auto p-2 rounded-xl btn-touch transition-colors ${
          isCapturing
            ? "text-red-400 bg-red-500/15 hover:bg-red-500/25"
            : "text-muted-foreground hover:text-cyan-400"
        } ${!voiceSupported ? "opacity-40 cursor-not-allowed" : ""}`}
        title={voiceTooltip}
        aria-label={voiceTooltip}
      >
        {isCapturing ? <MicOff size={18} /> : <Mic size={18} />}
      </Button>

      {/* Mode flip pill */}
      <div className="flex items-center rounded-xl border border-white/10 overflow-hidden zed-glass">
        <button
          onClick={() => onModeToggle("chat")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center space-x-1 ${
            currentMode === "chat"
              ? "bg-white/10 text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Chat</span>
        </button>
        <div className="w-px h-4 bg-white/10" />
        <button
          onClick={() => onModeToggle("agent")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center space-x-1.5 ${
            currentMode === "agent"
              ? "bg-white/10 text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <img src={zLogoPath} alt="" className="w-3 h-3" />
          <span>Agent</span>
        </button>
      </div>

      {currentMode === "agent" && (
        <div className="flex flex-wrap items-center rounded-xl border border-white/10 overflow-hidden zed-glass">
          {[
            { key: "operations", label: "Ops" },
            { key: "research", label: "R&D" },
            { key: "business", label: "Biz" },
            { key: "finance", label: "Finance" },
          ].map((option) => (
            <button
              key={option.key}
              onClick={() => onAgentTargetChange(option.key as AgentTarget)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                agentTarget === option.key
                  ? "bg-white/10 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {isSubmitting && (
        <span className="ml-1 inline-flex items-center text-[11px] text-muted-foreground">
          <span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          Routing…
        </span>
      )}
    </div>
  );
}
