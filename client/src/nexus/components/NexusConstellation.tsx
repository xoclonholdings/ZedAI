import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import { routeForNexusNode } from "../graph/rootConstellation";
import type { NexusNodeDefinition, NexusNodeId } from "../graph/types";
import { useNexus } from "../state/NexusProvider";
import { NexusIcon } from "./NexusIcon";

/** Pulls the 42-radius ring in slightly so orbs never clip the rounded frame edge. */
const RENDER_INSET = 0.86;

export function NexusConstellation() {
  const [, navigate] = useLocation();
  const { snapshot, viewportSnapshot, focusNode } = useNexus();
  const activeId = viewportSnapshot.focusedNode?.id ?? snapshot.activeNode?.id ?? null;
  const nodesById = new Map(snapshot.rootNodes.map((node) => [node.id, node]));
  const ringConnections = snapshot.connections.filter((connection) => connection.kind === "orbit");

  function focusAndRoute(nodeId: NexusNodeId) {
    focusNode(nodeId, "touch");
    navigate(routeForNexusNode(nodeId));
  }

  return (
    <section
      className="relative min-h-[200px] w-full flex-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#02030a] shadow-[0_28px_90px_rgba(0,0,0,0.34)]"
      aria-label="ZAR Nexus constellation"
    >
      <div className="pointer-events-none absolute inset-0 opacity-80 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:38px_38px] motion-safe:animate-[nexus-drift_24s_linear_infinite] motion-reduce:animate-none" />
      <div
        className="nexus-particle-field pointer-events-none absolute inset-0 motion-safe:animate-[nexus-twinkle_7s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:opacity-60"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),rgba(2,3,10,0)_44%),radial-gradient(circle_at_18%_14%,rgba(167,139,250,0.14),rgba(2,3,10,0)_38%),radial-gradient(circle_at_84%_20%,rgba(244,114,182,0.12),rgba(2,3,10,0)_34%),radial-gradient(circle_at_78%_86%,rgba(251,146,60,0.07),rgba(2,3,10,0)_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.55)_100%)]" />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Nexus connections"
        preserveAspectRatio="none"
      >
        <defs>
          {/*
            userSpaceOnUse + fixed center avoids the degenerate objectBoundingBox
            case a linearGradient hits on perfectly horizontal/vertical lines (the
            four cardinal spokes), which otherwise renders as a stray rectangle.
          */}
          <radialGradient id="nexus-line-energy" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="45">
            <stop offset="0%" stopColor="rgba(125,211,252,0.55)" />
            <stop offset="65%" stopColor="rgba(125,211,252,0.32)" />
            <stop offset="100%" stopColor="rgba(244,114,182,0.14)" />
          </radialGradient>
        </defs>

        {ringConnections.map((connection) => {
          const source = nodesById.get(connection.sourceId);
          const target = nodesById.get(connection.targetId);
          if (!source || !target) return null;
          const sourcePos = renderPosition(source);
          const targetPos = renderPosition(target);
          const active = activeId === source.id || activeId === target.id;
          return (
            <line
              key={connection.id}
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              stroke={active ? "url(#nexus-line-energy)" : "rgba(148,163,184,0.12)"}
              strokeWidth={active ? 0.55 : 0.28}
              strokeDasharray={active ? "3 2" : undefined}
              className={cn(
                "motion-safe:transition-[stroke,stroke-width] motion-reduce:transition-none",
                active && "motion-safe:animate-[nexus-flow_1.8s_linear_infinite] motion-reduce:animate-none",
              )}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {snapshot.rootNodes.map((node) => {
          const pos = renderPosition(node);
          const active = activeId === node.id;
          return (
            <line
              key={`spoke:${node.id}`}
              x1={50}
              y1={50}
              x2={pos.x}
              y2={pos.y}
              stroke={active ? "url(#nexus-line-energy)" : "rgba(148,163,184,0.12)"}
              strokeWidth={active ? 0.6 : 0.24}
              strokeDasharray={active ? "3 2" : undefined}
              className={cn(
                "motion-safe:transition-[stroke,stroke-width] motion-reduce:transition-none",
                active && "motion-safe:animate-[nexus-flow_1.8s_linear_infinite] motion-reduce:animate-none",
              )}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {snapshot.rootNodes.map((node) => {
          const pos = renderPosition(node);
          const mid = { x: 50 + (pos.x - 50) * 0.55, y: 50 + (pos.y - 50) * 0.55 };
          const color = node.metadata.visual.color;
          return (
            <g key={`bead:${node.id}`}>
              <circle cx={mid.x} cy={mid.y} r={1.6} fill={color} opacity={0.22} />
              <circle cx={mid.x} cy={mid.y} r={0.85} fill={color} opacity={0.95} />
            </g>
          );
        })}

      </svg>

      {/*
        Hub rings are plain HTML circles (real px width/height via rounded-full),
        not SVG: the connections <svg> above uses preserveAspectRatio="none" to
        match percentage node positions, which would stretch true SVG circles
        into ellipses on any non-square container. Ring color comes from
        mask-image (radial-gradient) punching a ring out of a solid conic-gradient
        disc - border-image was tried first but does not reliably clip to
        border-radius, and rendered as a rotated square artifact instead of a ring.
      */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-[nexus-rotate-slow_38s_linear_infinite] motion-reduce:animate-none sm:h-32 sm:w-32"
        style={{
          background: "conic-gradient(from 0deg, rgba(34,211,238,0.55), transparent 22%, rgba(167,139,250,0.5), transparent 55%, rgba(244,114,182,0.45), transparent 88%, rgba(34,211,238,0.55))",
          WebkitMaskImage: "radial-gradient(circle, transparent 63%, black 65%, black 100%)",
          maskImage: "radial-gradient(circle, transparent 63%, black 65%, black 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-[nexus-rotate-slow-reverse_26s_linear_infinite] motion-reduce:animate-none sm:h-24 sm:w-24"
        style={{
          background: "conic-gradient(from 90deg, rgba(244,114,182,0.4), transparent 30%, rgba(34,211,238,0.45), transparent 70%, rgba(244,114,182,0.4))",
          WebkitMaskImage: "radial-gradient(circle, transparent 60%, black 62%, black 100%)",
          maskImage: "radial-gradient(circle, transparent 60%, black 62%, black 100%)",
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-cyan-200/70 shadow-[0_0_8px_2px_rgba(103,232,249,0.6)] motion-safe:animate-[nexus-orbit-drift_18s_linear_infinite] motion-reduce:hidden"
        style={{ "--nexus-orbit-radius": "72px" } as React.CSSProperties}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-[3px] rounded-full bg-fuchsia-200/60 shadow-[0_0_8px_2px_rgba(232,121,249,0.55)] motion-safe:animate-[nexus-orbit-drift_26s_linear_infinite_reverse] motion-reduce:hidden"
        style={{ "--nexus-orbit-radius": "58px" } as React.CSSProperties}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-[nexus-pulse_8s_ease-in-out_infinite] motion-reduce:animate-none sm:h-28 sm:w-28"
        style={{ background: "radial-gradient(circle, rgba(251,146,60,0.28), rgba(217,70,239,0.2) 38%, rgba(56,189,248,0.16) 64%, transparent 80%)" }}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center" aria-hidden="true">
        <span className="text-lg font-bold uppercase tracking-[0.28em] text-white drop-shadow-[0_0_18px_rgba(125,211,252,0.55)] sm:text-xl">
          Nexus
        </span>
      </div>

      {snapshot.rootNodes.map((node) => {
        const visual = node.metadata.visual;
        const pos = renderPosition(node);
        const focused = node.id === activeId;

        return (
          <div
            key={node.id}
            className="absolute flex flex-col items-center gap-1.5 motion-safe:transition-[opacity] motion-reduce:transition-none"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)", zIndex: focused ? 15 : 10 }}
          >
            <button
              type="button"
              aria-current={focused ? "page" : undefined}
              aria-label={`${focused ? "Focused" : "Focus"} ${node.label}`}
              onClick={() => focusAndRoute(node.id)}
              className={cn(
                "group relative flex items-center justify-center rounded-full bg-black/55 backdrop-blur-md transition hover:scale-[1.06] focus:outline-none focus:ring-2 focus:ring-cyan-200/60 focus:ring-offset-2 focus:ring-offset-black motion-reduce:transition-none",
                focused ? "h-[72px] w-[72px] border-2 sm:h-20 sm:w-20" : "h-16 w-16 border-[1.5px] sm:h-[72px] sm:w-[72px]",
              )}
              style={{
                borderColor: focused ? visual.color : `${visual.color}90`,
                boxShadow: focused
                  ? `0 0 0 1px ${visual.color}30, 0 0 34px ${visual.color}55, inset 0 0 16px ${visual.color}1a`
                  : `0 0 18px ${visual.color}28, inset 0 0 12px ${visual.color}14`,
              }}
            >
              {focused && (
                <span
                  aria-hidden="true"
                  className="absolute -inset-2 rounded-full border motion-safe:animate-[nexus-orbit-glow_5s_ease-in-out_infinite] motion-reduce:animate-none"
                  style={{ borderColor: `${visual.color}35` }}
                />
              )}
              <span
                className="flex items-center justify-center"
                style={{ color: visual.color, filter: `drop-shadow(0 0 6px ${visual.color}70)` }}
              >
                <NexusIcon name={visual.icon} size={focused ? 26 : 22} />
              </span>
            </button>

            <span
              className={cn(
                "pointer-events-none max-w-[84px] truncate text-center font-semibold uppercase tracking-[0.1em]",
                focused ? "text-[10.5px] text-white" : "text-[9.5px] text-white/72",
              )}
            >
              {node.label}
            </span>
          </div>
        );
      })}
    </section>
  );
}

function renderPosition(node: NexusNodeDefinition) {
  const { x, y } = node.metadata.visual.coordinates2d;
  return {
    x: 50 + (x - 50) * RENDER_INSET,
    y: 50 + (y - 50) * RENDER_INSET,
  };
}
