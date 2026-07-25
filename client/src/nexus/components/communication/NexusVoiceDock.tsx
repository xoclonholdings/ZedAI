import { Mic, MicOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { useNexusDictation } from "../../communication/useNexusDictation";

const BAR_COUNT = 26;

/**
 * The persistent voice affordance: a state-driven waveform strip with the
 * microphone floating over its center. States are driven by real system
 * state (dictation active / ZAR responding) - no fake audio sync, since the
 * current stack exposes no amplitude data.
 */
export function NexusVoiceDock({
  onTranscript,
  isResponding,
}: {
  readonly onTranscript: (text: string) => void;
  readonly isResponding: boolean;
}) {
  const dictation = useNexusDictation(onTranscript);
  const state = dictation.isDictating ? "listening" : isResponding ? "responding" : "idle";

  return (
    <div className="relative mt-3 flex shrink-0 items-center justify-center pb-safe" data-nexus-voice={state}>
      <div className="pointer-events-none absolute inset-x-2 flex h-9 items-center justify-between gap-[2px]" aria-hidden="true">
        {Array.from({ length: BAR_COUNT }, (_, index) => (
          <span
            key={index}
            className={cn(
              "w-[2.5px] rounded-full",
              state === "idle" && "h-[3px] bg-white/20 motion-safe:animate-[nexus-wave-idle_5s_ease-in-out_infinite]",
              state === "listening" && "h-2 bg-cyan-300/70 motion-safe:animate-[nexus-wave-active_1.1s_ease-in-out_infinite]",
              state === "responding" && "h-2 bg-violet-300/70 motion-safe:animate-[nexus-wave-active_1.6s_ease-in-out_infinite]",
              "motion-reduce:animate-none",
            )}
            style={{ animationDelay: `${(index % 9) * 0.13}s` }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={dictation.toggle}
        disabled={!dictation.speechSupported}
        aria-pressed={dictation.isDictating}
        aria-label={
          dictation.speechSupported
            ? dictation.isDictating ? "Stop listening" : "Talk to ZAR"
            : "Voice input unavailable"
        }
        title={
          dictation.speechSupported
            ? dictation.isDictating ? "Stop listening" : "Talk to ZAR"
            : "Voice input unavailable"
        }
        className={cn(
          "relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-cyan-200/60 focus:ring-offset-2 focus:ring-offset-black motion-reduce:transition-none motion-reduce:animate-none",
          dictation.isDictating
            ? "border-red-300/60 bg-red-500/15 text-red-200"
            : "border-violet-300/50 bg-black/60 text-cyan-100 shadow-[0_0_26px_rgba(139,92,246,0.35)] motion-safe:animate-[nexus-breathe_5s_ease-in-out_infinite]",
          !dictation.speechSupported && "opacity-40",
        )}
      >
        {dictation.isDictating ? <MicOff size={21} /> : <Mic size={21} />}
      </button>
    </div>
  );
}
