import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import { routeForNexusNode } from "../graph/rootConstellation";
import type { NexusNodeId } from "../graph/types";
import { useNexus } from "../state/NexusProvider";
import { NexusIcon } from "./NexusIcon";

const DRAG_THRESHOLD_PX = 44;

export function NexusConstellation() {
  const [, navigate] = useLocation();
  const {
    snapshot,
    viewport,
    viewportSnapshot,
    focusNode,
    focusAdjacentNode,
    panViewport,
  } = useNexus();
  const dragRef = useRef<{
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly lastX: number;
    readonly lastY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const activeId = viewportSnapshot.focusedNode?.id ?? snapshot.activeNode?.id ?? null;

  function focusAndRoute(nodeId: NexusNodeId, source: "touch" | "keyboard" | "zar" | "programmatic") {
    focusNode(nodeId, source);
    navigate(routeForNexusNode(nodeId));
  }

  function moveFocus(direction: "previous" | "next", source: "touch" | "keyboard") {
    const nextNodeId = focusAdjacentNode(direction, source);
    if (nextNodeId) navigate(routeForNexusNode(nextNodeId));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    panViewport((event.clientX - drag.lastX) / 18, (event.clientY - drag.lastY) / 22, "touch");
    dragRef.current = {
      ...drag,
      lastX: event.clientX,
      lastY: event.clientY,
    };
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    dragRef.current = null;
    setDragging(false);

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < DRAG_THRESHOLD_PX) return;
    const direction = Math.abs(deltaX) >= Math.abs(deltaY)
      ? deltaX < 0 ? "next" : "previous"
      : deltaY < 0 ? "next" : "previous";
    moveFocus(direction, "touch");
  }

  return (
    <section
      className="relative min-h-[430px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#02030a] shadow-[0_28px_90px_rgba(0,0,0,0.34)] sm:min-h-[520px]"
      aria-label="ZAR Nexus constellation"
    >
      <div className="pointer-events-none absolute inset-0 opacity-80 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:38px_38px] motion-safe:animate-[nexus-drift_24s_linear_infinite] motion-reduce:animate-none" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.16),rgba(2,3,10,0)_42%),radial-gradient(circle_at_30%_18%,rgba(244,114,182,0.12),rgba(2,3,10,0)_36%)]" />

      <div className="absolute left-4 top-4 z-20 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-medium text-white/58 backdrop-blur-md">
        Explore
      </div>

      <button
        type="button"
        onClick={() => moveFocus("previous", "keyboard")}
        className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/65 backdrop-blur-md transition hover:border-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/60 motion-reduce:transition-none"
        aria-label="Focus previous Nexus space"
      >
        <ChevronLeft size={18} />
      </button>

      <button
        type="button"
        onClick={() => moveFocus("next", "keyboard")}
        className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/65 backdrop-blur-md transition hover:border-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/60 motion-reduce:transition-none"
        aria-label="Focus next Nexus space"
      >
        <ChevronRight size={18} />
      </button>

      <div
        className={cn(
          "absolute inset-0 cursor-grab touch-pan-y select-none",
          dragging && "cursor-grabbing",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerCancel={handlePointerEnd}
        onPointerUp={handlePointerEnd}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          role="img"
          aria-label="Visible Nexus connections"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="nexus-line-energy" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(125,211,252,0.05)" />
              <stop offset="50%" stopColor="rgba(125,211,252,0.5)" />
              <stop offset="100%" stopColor="rgba(244,114,182,0.08)" />
            </linearGradient>
          </defs>
          {viewportSnapshot.visibleConnections.map((connection) => (
            <line
              key={connection.id}
              x1={connection.source.x}
              y1={connection.source.y}
              x2={connection.target.x}
              y2={connection.target.y}
              stroke={connection.active ? "url(#nexus-line-energy)" : "rgba(148,163,184,0.18)"}
              strokeWidth={connection.active ? 0.7 : 0.38}
              vectorEffect="non-scaling-stroke"
              className="motion-safe:transition-all motion-reduce:transition-none"
            />
          ))}
          {viewportSnapshot.hasMoreBefore && (
            <path
              d="M 0 70 C 16 57, 22 44, 32 37"
              fill="none"
              stroke="rgba(148,163,184,0.16)"
              strokeDasharray="1.6 2"
              strokeWidth="0.45"
            />
          )}
          {viewportSnapshot.hasMoreAfter && (
            <path
              d="M 100 72 C 86 57, 80 44, 70 38"
              fill="none"
              stroke="rgba(148,163,184,0.16)"
              strokeDasharray="1.6 2"
              strokeWidth="0.45"
            />
          )}
        </svg>

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/10 bg-black/20 shadow-[0_0_70px_rgba(56,189,248,0.18)] motion-safe:animate-[nexus-pulse_8s_ease-in-out_infinite] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[61%] -translate-x-1/2 text-center"
          aria-hidden="true"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">
            Nexus
          </div>
        </div>

        {viewportSnapshot.visibleNodes.map(({ node, position, presence, relativeIndex }) => {
          const visual = node.metadata.visual;
          const focused = node.id === activeId;
          const edge = presence === "edge";
          return (
            <div
              key={`${node.id}:${viewport.transitionSerial}`}
              className="absolute motion-safe:transition-[left,top,opacity,transform] motion-safe:duration-500 motion-safe:ease-out motion-reduce:transition-none"
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                transform: "translate(-50%, -50%)",
                opacity: edge ? 0.58 : focused ? 1 : 0.84,
                zIndex: focused ? 18 : edge ? 8 : 12,
              }}
            >
              <button
                type="button"
                aria-current={focused ? "page" : undefined}
                aria-label={`${focused ? "Focused" : "Focus"} ${node.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  focusAndRoute(node.id, "touch");
                }}
                className={cn(
                  "group flex flex-col items-center justify-center border bg-black/75 text-center shadow-lg backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-cyan-200/60 motion-reduce:transition-none",
                  focused
                    ? "h-[118px] w-[118px] rounded-2xl border-cyan-200/70"
                    : edge
                      ? "h-[78px] w-[78px] rounded-xl border-white/[0.11]"
                      : "h-[94px] w-[94px] rounded-2xl border-white/[0.14]",
                  !edge && "hover:border-cyan-200/55 hover:bg-white/[0.055]",
                )}
                style={{
                  boxShadow: focused
                    ? `0 0 44px ${visual.color}55`
                    : `0 0 22px ${visual.color}22`,
                }}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border border-white/10",
                    focused ? "h-11 w-11" : "h-9 w-9",
                  )}
                  style={{ color: visual.color, backgroundColor: `${visual.color}14` }}
                >
                  <NexusIcon name={visual.icon} size={focused ? 22 : 17} />
                </span>
                <span
                  className={cn(
                    "mt-2 block max-w-[88px] truncate font-semibold text-white",
                    focused ? "text-[13.5px]" : "text-[11.5px]",
                  )}
                >
                  {node.label}
                </span>
                {focused && (
                  <span className="mt-1 max-w-[94px] text-[10px] leading-3 text-white/45">
                    In focus
                  </span>
                )}
                <span className="sr-only">
                  {relativeIndex < 0 ? "Previous constellation space" : relativeIndex > 0 ? "Next constellation space" : "Current constellation space"}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
