import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useNexus } from "../state/NexusProvider";
import { createFocusedNodeView } from "../viewport/NexusViewportModel";
import { NexusIcon } from "./NexusIcon";

export interface NexusFocusedNodePanelProps {
  /** "panel" is the full card (desktop aside). "compact" is a single-row strip that fits the mobile one-screen shell without adding scroll. */
  readonly variant?: "panel" | "compact";
  readonly className?: string;
  /** STATE 4 (Enter): call with the gateway action's route rather than navigating directly, so Warp can play first. */
  readonly onEnterAction: (route: string | null) => void;
  /** Hub -> Back -> Home. */
  readonly onBack: () => void;
}

export function NexusFocusedNodePanel({ variant = "panel", className, onEnterAction, onBack }: NexusFocusedNodePanelProps) {
  const { capabilityRegistry, viewportSnapshot } = useNexus();
  const focusedNode = viewportSnapshot.focusedNode;
  if (!focusedNode) return null;

  const view = createFocusedNodeView(focusedNode, capabilityRegistry);

  if (variant === "compact") {
    return (
      <section
        className={cn("flex flex-col gap-1.5 px-1 py-1", className)}
        aria-labelledby="nexus-focused-node-title-compact"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none"
            aria-label="Back to Nexus"
            title="Back to Nexus"
          >
            <ArrowLeft size={14} aria-hidden="true" />
          </button>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{ color: view.accentColor, backgroundColor: `${view.accentColor}16` }}
            aria-hidden="true"
          >
            <NexusIcon name={view.icon} size={14} />
          </span>
          <h2 id="nexus-focused-node-title-compact" className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/80">
            {view.title}
          </h2>
        </div>

        {view.actions.length > 0 && (
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="list"
            aria-label={`${view.title} gateway actions`}
          >
            {view.actions.map((action) => (
              <button
                key={`${view.nodeId}:${action.label}`}
                type="button"
                role="listitem"
                onClick={() => onEnterAction(action.route)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-white/[0.08] bg-black/25 px-2.5 py-1 text-[11.5px] font-medium text-white/80 transition hover:border-cyan-200/35 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none"
              >
                {action.label}
                <ArrowUpRight size={11} className="shrink-0 text-cyan-100/65" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      className={cn("rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5", className)}
      aria-labelledby="nexus-focused-node-title"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none"
          aria-label="Back to Nexus"
          title="Back to Nexus"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10"
          style={{ color: view.accentColor, backgroundColor: `${view.accentColor}14` }}
          aria-hidden="true"
        >
          <NexusIcon name={view.icon} size={22} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
            In Focus
          </div>
          <h2 id="nexus-focused-node-title" className="mt-1 text-2xl font-semibold text-white">
            {view.title}
          </h2>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-white/68">
        {view.summary}
      </p>

      {view.actions.length > 0 && (
        <div className="mt-5 space-y-2">
          {view.actions.map((action) => (
            <button
              key={`${view.nodeId}:${action.label}`}
              type="button"
              onClick={() => onEnterAction(action.route)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3 text-left transition hover:border-cyan-200/35 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-white/88">{action.label}</span>
                <span className="mt-1 block text-[12px] leading-5 text-white/52">{action.summary}</span>
              </span>
              <ArrowUpRight size={15} className="shrink-0 text-cyan-100/65" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
