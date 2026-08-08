import { ChevronLeft } from "lucide-react";

import { useNexys } from "../state/NexysProvider";
import { createFocusedNodeView } from "../viewport/NexysViewportModel";

export interface NexysHubOverlayProps {
  readonly onBack: () => void;
}

/**
 * The Hub reveal (STATE 3): just the back-to-Nexys pill and the focused
 * domain's name, floating over the universe. Entering a domain happens by
 * tapping the centered planet itself (see NexysRootPage's handleFocusedTap)
 * - no separate action-pill row to choose from.
 */
export function NexysHubOverlay({ onBack }: NexysHubOverlayProps) {
  const { capabilityRegistry, viewportSnapshot } = useNexys();
  const focusedNode = viewportSnapshot.focusedNode;
  if (!focusedNode) return null;

  const view = createFocusedNodeView(focusedNode, capabilityRegistry);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[92px] z-20 flex flex-col items-center gap-2 px-4"
      style={{ animation: "nexys-settle 500ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
      data-nexys-region="focused"
    >
      <div
        className="pointer-events-auto flex items-center gap-2 rounded-full border bg-black/40 py-1.5 pl-2 pr-5 backdrop-blur-md"
        style={{ borderColor: `${view.accentColor}3a` }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Nexys"
          title="Back to Nexys"
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
