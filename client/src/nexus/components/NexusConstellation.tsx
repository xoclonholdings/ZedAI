import { ChevronDown, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import { useNexus } from "../state/NexusProvider";
import { NexusIcon } from "./NexusIcon";

export function NexusConstellation() {
  const [, navigate] = useLocation();
  const { snapshot, activateNode, toggleNode } = useNexus();
  const activeId = snapshot.activeNode?.id ?? null;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[620px] min-w-[300px]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Nexus root constellation connections"
      >
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="0.4" />
        {snapshot.connections.map((connection) => {
          const source = snapshot.nodes.find((node) => node.id === connection.sourceId);
          const target = snapshot.nodes.find((node) => node.id === connection.targetId);
          if (!source || !target) return null;
          const isActive = source.id === activeId || target.id === activeId;
          return (
            <line
              key={connection.id}
              x1={source.metadata.visual.coordinates2d.x}
              y1={source.metadata.visual.coordinates2d.y}
              x2={target.metadata.visual.coordinates2d.x}
              y2={target.metadata.visual.coordinates2d.y}
              stroke={isActive ? "rgba(125, 211, 252, 0.64)" : "rgba(148, 163, 184, 0.18)"}
              strokeWidth={isActive ? 0.9 : 0.45}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.12] bg-black/80 text-center shadow-[0_0_44px_rgba(56,189,248,0.16)]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Nexus</div>
          <div className="mt-1 text-[10px] text-white/45">Root</div>
        </div>
      </div>

      {snapshot.rootNodes.map((node) => {
        const visual = node.metadata.visual;
        const active = activeId === node.id;
        const expanded = snapshot.expandedNodeIds.includes(node.id);
        return (
          <div
            key={node.id}
            className="absolute"
            style={{
              left: `${visual.coordinates2d.x}%`,
              top: `${visual.coordinates2d.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <button
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => {
                activateNode(node.id);
                navigate(node.metadata.route);
              }}
              className={cn(
                "group flex h-[86px] w-[86px] flex-col items-center justify-center rounded-lg border bg-black/80 px-2 text-center transition-colors",
                "hover:border-cyan-200/60 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-300/50",
                active ? "border-cyan-200/70 shadow-[0_0_28px_rgba(56,189,248,0.24)]" : "border-white/[0.12]",
              )}
              style={{
                boxShadow: active ? `0 0 32px ${visual.color}44` : undefined,
              }}
            >
              <span
                className="mb-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/10"
                style={{ color: visual.color, backgroundColor: `${visual.color}12` }}
              >
                <NexusIcon name={visual.icon} size={17} />
              </span>
              <span className="block max-w-full truncate text-[12px] font-semibold text-white">{node.label}</span>
              <span className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/35">
                root
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggleNode(node.id)}
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black text-white/65 hover:border-white/30 hover:text-white"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${node.label}`}
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
