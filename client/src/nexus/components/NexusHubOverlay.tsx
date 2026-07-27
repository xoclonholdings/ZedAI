import { ChevronLeft } from "lucide-react";

import { useNexus } from "../state/NexusProvider";
import { createFocusedNodeView } from "../viewport/NexusViewportModel";

export interface NexusHubOverlayProps {
  readonly onBack: () => void;
}

/**
 * The Hub reveal (STATE 3): just the back-to-Nexus pill and the focused
 * domain's name, floating over the universe. Entering a domain happens by
 * tapping the centered planet itself (see NexusRootPage's handleFocusedTap)
 * - no separate action-pill row to choose from.
 */
export function NexusHubOverlay({ onBack }: NexusHubOverlayProps) {
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
    </div>
  );
}
