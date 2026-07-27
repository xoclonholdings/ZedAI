import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { useLocation } from "wouter";

import { iconForMode } from "@/nexus/components/NexusConversationSurface";
import { useNexus } from "@/nexus/state/NexusProvider";
import { communicationModeViews } from "@/nexus/viewport/NexusViewportModel";

/**
 * The console's standby face: one line of the six tool icons, one line of a
 * compact composer. Tapping a tool powers the console on already showing
 * that tool; typing and sending goes straight to chat without powering on,
 * exactly like the expanded dock's own "text" mode does today.
 */
export function ConsoleStandbyBar({
  onActivate,
  accent,
}: {
  readonly onActivate: (modeId: string) => void;
  readonly accent: string;
}) {
  const [, navigate] = useLocation();
  const { communicationLayer } = useNexus();
  const [draft, setDraft] = useState("");
  const modes = useMemo(() => communicationModeViews(communicationLayer), [communicationLayer]);

  function handleModeTap(modeId: string) {
    if (modeId === "text") {
      navigate("/chat");
      return;
    }
    onActivate(modeId);
  }

  function submitDraft() {
    const text = draft.trim();
    if (!text) return;
    navigate(`/chat?draft=${encodeURIComponent(text)}`);
    setDraft("");
  }

  return (
    <div
      className="w-full rounded-2xl border bg-black/40 px-3 py-2 backdrop-blur-2xl transition-colors duration-500"
      style={{ borderColor: `${accent}30` }}
    >
      <div className="flex items-center justify-around gap-1 pb-2" aria-label="Console tools">
        {modes.map((mode) => {
          const Icon = iconForMode(mode.id);
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleModeTap(mode.id)}
              disabled={!mode.enabled}
              className="flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-white/55 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/50 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={mode.label}
              title={mode.label}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
      <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
        <textarea
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitDraft();
            }
          }}
          placeholder="Ask ZAR anything..."
          className="min-h-[40px] flex-1 resize-none bg-transparent text-[13px] leading-snug text-white placeholder:text-white/35 focus:outline-none"
        />
        <button
          type="button"
          onClick={submitDraft}
          aria-label="Send"
          className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cyan-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
