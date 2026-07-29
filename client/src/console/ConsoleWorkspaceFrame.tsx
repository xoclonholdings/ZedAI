import { useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "wouter";

import { nexusRootManifestRegistry, type NexusRootNodeId } from "@/nexus/manifests/rootManifests";
import { ConsoleGlassPanel, CONSOLE_CONTENT_REGION_CLASS } from "./ConsoleGlassPanel";
import { ConsoleLogoutButton } from "./ConsoleLogoutButton";
import { ConsoleShell } from "./ConsoleShell";
import { ZAR_NEXUS_CONSOLE } from "./consoleIdentity";

/**
 * Wraps one of the 8 root-node routes (identity, memory, knowledge,
 * workspaces, projects, tools, connect, settings) so its existing page
 * content renders as workspace content inside the console instead of as a
 * bare standalone page. The route, its data fetching, and its business logic
 * are untouched - only the presentation chrome around it changes.
 *
 * Some routes (Trading Intelligence) aren't one of the 8 galaxy domains and
 * have no NexusRootNodeId to look a label/accent up from - `label`/`accent`
 * let those pages use the same frame anyway, without inventing a fake root
 * node for them.
 */
export function ConsoleWorkspaceFrame({
  nodeId,
  label: labelOverride,
  accent: accentOverride,
  children,
}: {
  readonly nodeId?: NexusRootNodeId;
  readonly label?: string;
  readonly accent?: string;
  readonly children: ReactNode;
}) {
  const [, navigate] = useLocation();
  const [dockPowered, setDockPowered] = useState(false);
  const reducedMotion = useReducedMotion();

  const manifest = nodeId ? nexusRootManifestRegistry.getManifest(nodeId) : undefined;
  const label = labelOverride ?? manifest?.label ?? nodeId ?? "Workspace";
  const accent = accentOverride ?? manifest?.visual.color ?? ZAR_NEXUS_CONSOLE.accent;
  const identity = { ...ZAR_NEXUS_CONSOLE, accent };

  return (
    <ConsoleShell
      identity={identity}
      dockPowered={dockPowered}
      onDockPowerChange={setDockPowered}
      headerLeft={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/nexus")}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-medium tracking-[0.08em] text-white/70 backdrop-blur transition hover:border-white/25 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
            aria-label="Back to Nexus"
          >
            <ChevronLeft size={14} /> NEXUS
          </button>
          <ConsoleLogoutButton />
        </div>
      }
      headerRightExtra={
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 backdrop-blur">
          <span
            className="block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: accent, boxShadow: `0 0 8px 2px ${accent}88` }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-medium tracking-[0.2em] text-white/70">{label.toUpperCase()}</span>
        </div>
      }
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse 85% 70% at 50% 25%, ${accent}1f 0%, ${accent}0d 40%, transparent 75%)`,
        }}
      />
      <motion.div
        className={`${CONSOLE_CONTENT_REGION_CLASS} pb-3`}
        data-console-region="workspace"
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto h-full max-w-3xl">
          <ConsoleGlassPanel>{children}</ConsoleGlassPanel>
        </div>
      </motion.div>
    </ConsoleShell>
  );
}
