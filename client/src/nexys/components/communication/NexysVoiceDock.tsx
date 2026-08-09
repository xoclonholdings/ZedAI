import { Mic, MicOff } from "lucide-react";

import { cn } from "@/lib/utils";
import type { useNexysForegroundVoice } from "../../communication/useNexysDictation";

const BAR_COUNT = 26;

/**
 * The persistent voice affordance: a state-driven waveform strip with the
 * microphone floating over its center. States are driven by the real
 * foreground recognition, command submission, and speech-output lifecycle -
 * no fake audio sync, since the browser exposes no amplitude data here.
 *
 * `voice` is owned by the parent (not this component) so the console's
 * own "Talk" mode button can trigger the exact same toggle this mic button
 * does, rather than each maintaining a separate voice session.
 */
export function NexysVoiceDock({
  voice,
}: {
  readonly voice: ReturnType<typeof useNexysForegroundVoice>;
}) {
  const activeListening = voice.state === "requesting-permission" || voice.state === "armed" || voice.state === "listening";
  const caption = captionForVoice(voice);

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5" data-nexys-voice={voice.state}>
      <div className="relative flex w-full items-center justify-center">
        <div className="pointer-events-none absolute inset-x-2 flex h-9 items-center justify-between gap-[2px]" aria-hidden="true">
          {Array.from({ length: BAR_COUNT }, (_, index) => (
            <span
              key={index}
              className={cn(
                "w-[2.5px] rounded-full",
                !voice.active && "h-[3px] bg-white/20 motion-safe:animate-[nexys-wave-idle_5s_ease-in-out_infinite]",
                activeListening && "h-2 bg-cyan-300/70 motion-safe:animate-[nexys-wave-active_1.1s_ease-in-out_infinite]",
                voice.state === "processing" && "h-2 bg-violet-300/70 motion-safe:animate-[nexys-wave-active_1.6s_ease-in-out_infinite]",
                voice.state === "speaking" && "h-2 bg-emerald-300/70 motion-safe:animate-[nexys-wave-active_1.3s_ease-in-out_infinite]",
                "motion-reduce:animate-none",
              )}
              style={{ animationDelay: `${(index % 9) * 0.13}s` }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={voice.toggle}
          disabled={!voice.supported}
          aria-pressed={voice.active}
          aria-label={
            voice.supported
              ? voice.active ? "Stop ZAR voice" : "Activate ZAR voice"
              : "Foreground voice unavailable"
          }
          title={
            voice.supported
              ? voice.active ? "Stop ZAR voice" : "Activate ZAR voice"
              : "Foreground voice unavailable"
          }
          className={cn(
            "relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-cyan-200/60 focus:ring-offset-2 focus:ring-offset-black motion-reduce:transition-none motion-reduce:animate-none",
            voice.active
              ? "border-red-300/60 bg-red-500/15 text-red-200"
              : "border-violet-300/50 bg-black/60 text-cyan-100 shadow-[0_0_26px_rgba(139,92,246,0.35)] motion-safe:animate-[nexys-breathe_5s_ease-in-out_infinite]",
            !voice.supported && "opacity-40",
          )}
        >
          {voice.active ? <MicOff size={21} /> : <Mic size={21} />}
        </button>
      </div>
      <span className="text-center text-[11px] text-white/45" aria-live="polite" title={voice.detail || undefined}>{caption}</span>
    </div>
  );
}

function captionForVoice(voice: ReturnType<typeof useNexysForegroundVoice>): string {
  switch (voice.state) {
    case "requesting-permission":
      return "Allow microphone access";
    case "armed":
      return "Say “ZAR” or “Hey ZAR”";
    case "listening":
      return "Listening for your command…";
    case "processing":
      return "ZAR is processing…";
    case "speaking":
      return "ZAR is speaking…";
    case "cancelled":
      return "Voice stopped";
    case "failed":
      if (voice.active) return "Reconnecting voice…";
      if (voice.detail?.includes("Microphone access")) return "Microphone access required";
      if (voice.detail?.includes("No microphone")) return "Microphone unavailable";
      return "Voice failed — tap to retry";
    case "unsupported":
      return "Foreground voice unavailable";
    default:
      return "Tap to activate voice";
  }
}
