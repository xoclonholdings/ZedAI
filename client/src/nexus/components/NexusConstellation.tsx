import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import { routeForNexusNode } from "../graph/rootConstellation";
import type { NexusNodeDefinition, NexusNodeId } from "../graph/types";
import NexusScene from "../scene/NexusScene";
import {
  canUseNexusWebgl,
  createNexusDriftState,
  type NexusDriftState,
  type NexusSceneNode,
} from "../scene/nexusSceneContract";
import { useNexus } from "../state/NexusProvider";
import { NexusIcon } from "./NexusIcon";

/** Pulls the 42-radius ring in slightly so orbs never clip the region edge. */
const RENDER_INSET = 0.86;
const DRAG_LIMIT_PX = 14;
const TAP_THRESHOLD_PX = 7;

export function NexusConstellation() {
  const [, navigate] = useLocation();
  const { snapshot, viewportSnapshot, focusNode } = useNexus();
  const activeId = viewportSnapshot.focusedNode?.id ?? snapshot.activeNode?.id ?? null;

  const [webgl, setWebgl] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setWebgl(canUseNexusWebgl());
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const drift = useRef<NexusDriftState>(createNexusDriftState());
  const overlayRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  const dragOrigin = useRef<{ id: number; x: number; y: number } | null>(null);

  // One rAF loop damps drift toward its target and keeps the HTML label overlay
  // locked to the WebGL anchors (both consume the same drift state).
  useEffect(() => {
    if (!webgl || reducedMotion) return;
    let frame = 0;
    const tick = () => {
      const d = drift.current;
      d.x += (d.tx - d.x) * 0.09;
      d.y += (d.ty - d.y) * 0.09;
      if (dragOrigin.current === null) {
        d.tx *= 0.94;
        d.ty *= 0.94;
      }
      const overlay = overlayRef.current;
      if (overlay) overlay.style.transform = `translate(${d.x.toFixed(2)}px, ${d.y.toFixed(2)}px)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [webgl, reducedMotion]);

  const sceneNodes = useMemo<readonly NexusSceneNode[]>(
    () => snapshot.rootNodes.map((node) => {
      const pos = renderPosition(node);
      return { id: node.id, x: pos.x, y: pos.y, color: node.metadata.visual.color, focused: node.id === activeId };
    }),
    [snapshot.rootNodes, activeId],
  );

  function focusAndRoute(nodeId: NexusNodeId) {
    if (draggedRef.current) return;
    focusNode(nodeId, "touch");
    navigate(routeForNexusNode(nodeId));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragOrigin.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    draggedRef.current = false;
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    drift.current.px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    drift.current.py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    const origin = dragOrigin.current;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.hypot(dx, dy) > TAP_THRESHOLD_PX) draggedRef.current = true;
    drift.current.tx = clamp(dx * 0.45, -DRAG_LIMIT_PX, DRAG_LIMIT_PX);
    drift.current.ty = clamp(dy * 0.45, -DRAG_LIMIT_PX, DRAG_LIMIT_PX);
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLElement>) {
    if (dragOrigin.current?.id !== event.pointerId) return;
    dragOrigin.current = null;
    // Let the settled flag clear after the click event this gesture may produce.
    window.setTimeout(() => { draggedRef.current = false; }, 0);
  }

  return (
    <section
      className="relative min-h-[200px] w-full flex-1 touch-none select-none overflow-visible"
      aria-label="ZAR Nexus constellation"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {webgl ? (
        <div
          className="absolute -inset-x-6 -inset-y-8 [mask-image:radial-gradient(ellipse_at_center,black_58%,transparent_96%)]"
          aria-hidden="true"
        >
          <NexusScene nodes={sceneNodes} drift={drift} reducedMotion={reducedMotion} />
        </div>
      ) : (
        <FallbackField nodes={sceneNodes} />
      )}

      <div ref={overlayRef} className="absolute inset-0 will-change-transform">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center" aria-hidden="true">
          <span className="text-lg font-bold uppercase tracking-[0.3em] text-white drop-shadow-[0_0_20px_rgba(165,180,252,0.7)] sm:text-xl">
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
              className="absolute flex flex-col items-center gap-1"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)", zIndex: focused ? 15 : 10 }}
            >
              <button
                type="button"
                aria-current={focused ? "page" : undefined}
                aria-label={`${focused ? "Focused" : "Focus"} ${node.label}`}
                onClick={() => focusAndRoute(node.id)}
                className={cn(
                  "group relative flex items-center justify-center rounded-full border bg-black/45 backdrop-blur-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-200/60 focus:ring-offset-2 focus:ring-offset-black motion-reduce:transition-none",
                  focused ? "h-16 w-16 border-[1.5px] sm:h-[72px] sm:w-[72px]" : "h-14 w-14 sm:h-16 sm:w-16",
                )}
                style={{
                  borderColor: focused ? visual.color : `${visual.color}75`,
                  boxShadow: focused
                    ? `0 0 24px ${visual.color}50, inset 0 0 14px ${visual.color}20`
                    : `0 0 14px ${visual.color}30, inset 0 0 10px ${visual.color}14`,
                }}
              >
                <span
                  className="flex items-center justify-center"
                  style={{ color: visual.color, filter: `drop-shadow(0 0 7px ${visual.color}90)` }}
                >
                  <NexusIcon name={visual.icon} size={focused ? 25 : 21} />
                </span>
              </button>
              <span
                className={cn(
                  "pointer-events-none max-w-[84px] truncate text-center font-semibold uppercase tracking-[0.1em] [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]",
                  focused ? "text-[10.5px] text-white" : "text-[9.5px] text-white/78",
                )}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Static SVG constellation for environments without a usable WebGL context. */
function FallbackField({ nodes }: { readonly nodes: readonly NexusSceneNode[] }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      role="img"
      aria-label="Nexus connections"
      preserveAspectRatio="none"
    >
      {nodes.map((node) => (
        <line
          key={`spoke:${node.id}`}
          x1={50}
          y1={50}
          x2={node.x}
          y2={node.y}
          stroke={node.focused ? node.color : "rgba(148,163,184,0.16)"}
          strokeWidth={node.focused ? 0.5 : 0.24}
          strokeOpacity={node.focused ? 0.5 : 1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {nodes.map((node, index) => {
        const next = nodes[(index + 1) % nodes.length];
        return (
          <line
            key={`ring:${node.id}`}
            x1={node.x}
            y1={node.y}
            x2={next.x}
            y2={next.y}
            stroke="rgba(148,163,184,0.12)"
            strokeWidth={0.24}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {nodes.map((node) => (
        <circle key={`anchor:${node.id}`} cx={node.x} cy={node.y} r={node.focused ? 1.4 : 0.9} fill={node.color} opacity={0.9} />
      ))}
    </svg>
  );
}

function renderPosition(node: NexusNodeDefinition) {
  const { x, y } = node.metadata.visual.coordinates2d;
  return {
    x: 50 + (x - 50) * RENDER_INSET,
    y: 50 + (y - 50) * RENDER_INSET,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
