import { Send } from "lucide-react";

import { iconForMode } from "@/nexys/components/NexysConversationSurface";
import { useNexysConsoleChat } from "@/nexys/communication/NexysConsoleChatContext";
import { NEXYS_DOCK_CONTROLS } from "@/nexys/dock/nexysDock";
import { useNexysDockAttention } from "@/nexys/notifications/NexysDockAttentionContext";

/**
 * The console's standby face: one line of the five Dock controls, one line of a
 * compact composer. Tapping a tool powers the console on already showing
 * that tool; typing and sending goes straight to chat without powering on,
 * through the existing chat surface.
 */
export function ConsoleStandbyBar({
  onActivate,
  accent,
}: {
  readonly onActivate: (modeId: string) => void;
  readonly accent: string;
}) {
  const { controller } = useNexysConsoleChat();
  const { hasAttention, acknowledgeReviewOnly } = useNexysDockAttention();

  function handleModeTap(modeId: string) {
    void acknowledgeReviewOnly(modeId as (typeof NEXYS_DOCK_CONTROLS)[number]["id"]);
    onActivate(modeId);
  }

  function submitDraft() {
    const text = controller.composerValue.trim();
    if (!text) return;
    onActivate("chat");
    void controller.sendMessage(text);
  }

  return (
    <div
      className="w-full rounded-2xl border bg-black/40 px-3 py-2 backdrop-blur-2xl transition-colors duration-500"
      style={{ borderColor: `${accent}30` }}
    >
      <div className="flex items-center justify-around gap-1 pb-2" aria-label="Console tools">
        {NEXYS_DOCK_CONTROLS.map((control) => {
          const Icon = iconForMode(control.id);
          return (
            <button
              key={control.id}
              type="button"
              onClick={() => handleModeTap(control.id)}
              className="flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-white/55 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/50 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={control.label}
              title={control.label}
            >
              <span className="relative">
                <Icon size={16} />
                {hasAttention(control.id) ? (
                  <span
                    className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_7px_rgba(252,211,77,0.9)]"
                    aria-label={`${control.label} needs attention`}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
        <textarea
          rows={2}
          value={controller.composerValue}
          onChange={(event) => controller.setComposerValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitDraft();
            }
          }}
          placeholder="Ask ZAR anything..."
          className="min-h-[40px] flex-1 resize-none bg-transparent text-[13px] leading-snug text-white placeholder:text-white/35 focus:outline-none"
          disabled={controller.isStreaming}
        />
        <button
          type="button"
          onClick={submitDraft}
          aria-label="Send"
          disabled={!controller.composerValue.trim() || controller.isStreaming}
          className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cyan-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200/50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
