import { useMemo, useState } from "react";
import { FileText, Image, MessageCircle, Mic, PenTool, Send, Upload } from "lucide-react";
import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import { useNexus } from "../state/NexusProvider";
import {
  communicationModeViews,
  resolveNexusNavigationIntent,
  type NexusCommunicationModeView,
} from "../viewport/NexusViewportModel";

export function NexusCommunicationDock() {
  const [, navigate] = useLocation();
  const {
    capabilityRegistry,
    communicationLayer,
    navigateToNode,
    viewportSnapshot,
    snapshot,
  } = useNexus();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("Ready");
  const modes = useMemo(() => communicationModeViews(communicationLayer), [communicationLayer]);
  const focusedLabel = viewportSnapshot.focusedNode?.label ?? "Nexus";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      navigate(communicationLayer.route);
      return;
    }

    const resolution = resolveNexusNavigationIntent(
      { kind: "query", query: trimmed },
      snapshot,
      capabilityRegistry,
      communicationLayer,
    );

    if (resolution?.kind === "node" && resolution.nodeId) {
      navigateToNode(resolution.nodeId, "zar");
      navigate(resolution.route);
      setStatus(`Focused ${resolution.label}`);
      setValue("");
      return;
    }

    if (resolution?.kind === "communication") {
      navigate(resolution.route);
      setStatus(`Opened ${resolution.label}`);
      setValue("");
      return;
    }

    navigate(communicationLayer.route);
    setStatus("Opened chat");
    setValue("");
  }

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-black/55 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-4"
      aria-label="Persistent ZAR communication"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
            ZAR
          </div>
          <div className="truncate text-sm text-white/70">
            {status} - Focused on {focusedLabel}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {modes.map((mode) => (
            <CommunicationModeButton
              key={mode.id}
              mode={mode}
              onSelect={() => {
                if (!mode.enabled) {
                  setStatus(`${mode.label} is not available yet`);
                  return;
                }
                navigate(mode.route ?? communicationLayer.route);
                setStatus(`Opened ${mode.label}`);
              }}
            />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <label className="sr-only" htmlFor="nexus-zar-input">
          Ask ZAR
        </label>
        <textarea
          id="nexus-zar-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ask ZAR, or say Open Memory..."
          rows={1}
          className="min-h-[46px] flex-1 resize-none rounded-2xl border border-white/[0.1] bg-white/[0.045] px-4 py-3 text-sm leading-5 text-white outline-none placeholder:text-white/35 focus:border-cyan-200/45 focus:ring-2 focus:ring-cyan-200/20"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-200/[0.12] text-cyan-100 transition hover:bg-cyan-200/[0.18] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none"
          aria-label="Send to ZAR"
        >
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}

function CommunicationModeButton({
  mode,
  onSelect,
}: {
  readonly mode: NexusCommunicationModeView;
  readonly onSelect: () => void;
}) {
  const Icon = iconForMode(mode.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!mode.enabled}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-white/62 transition hover:border-cyan-200/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none",
        !mode.enabled && "cursor-not-allowed opacity-40 hover:border-white/[0.08] hover:text-white/62",
      )}
      title={mode.label}
      aria-label={`${mode.label} communication`}
    >
      <Icon size={15} />
    </button>
  );
}

function iconForMode(modeId: string) {
  switch (modeId) {
    case "talk":
      return Mic;
    case "image":
      return Image;
    case "draw":
      return PenTool;
    case "doc":
      return FileText;
    case "upload":
      return Upload;
    case "text":
    default:
      return MessageCircle;
  }
}
