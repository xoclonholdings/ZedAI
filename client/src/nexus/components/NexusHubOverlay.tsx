import { ArrowUpRight, ChevronLeft } from "lucide-react";

import { useNexus } from "../state/NexusProvider";
import { createFocusedNodeView } from "../viewport/NexusViewportModel";

export interface NexusHubOverlayProps {
  /** STATE 4 (Enter): call with the gateway action's route rather than navigating directly, so Warp can play first. */
  readonly onEnterAction: (route: string | null) => void;
  readonly onBack: () => void;
}

/**
 * The Hub reveal (STATE 3), in the official Emergent overlay language: a
 * floating pill row over the universe, not a side card. Extends Emergent's
 * own "domain-overlay" title pill with a matching action-pill stack, since
 * the reference demo never had real actions to reveal - only a title.
 */
export function NexusHubOverlay({ onEnterAction, onBack }: NexusHubOverlayProps) {
  const { capabilityRegistry, viewportSnapshot } = useNexus();
  const focusedNode = viewportSnapshot.focusedNode;
  if (!focusedNode) return null;

  const view = createFocusedNodeView(focusedNode, capabilityRegistry);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[92px] z-20 flex flex-col items-center gap-2 px-4"
      style={{ animation: "nexus-settle 500ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
      data-nexus-region="focused"
    >
      <div
        className="pointer-events-auto flex items-center gap-2 rounded-full border bg-black/40 py-1.5 pl-2 pr-5 backdrop-blur-md"
        style={{ borderColor: `${view.accentColor}3a` }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Nexus"
          title="Back to Nexus"
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: view.accentColor, boxShadow: `0 0 8px 2px ${view.accentColor}88` }}
          aria-hidden="true"
        />
        <span className="text-xs font-semibold tracking-[0.35em]" style={{ color: view.accentColor }}>
          {view.title.toUpperCase()}
        </span>
      </div>

      {view.actions.length > 0 && (
        <div
          className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label={`${view.title} gateway actions`}
        >
          {view.actions.map((action) => (
            <button
              key={`${view.nodeId}:${action.label}`}
              type="button"
              role="listitem"
              onClick={() => onEnterAction(action.route)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-md transition hover:border-cyan-200/35 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
            >
              {action.label}
              <ArrowUpRight size={13} className="shrink-0 text-cyan-100/70" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
