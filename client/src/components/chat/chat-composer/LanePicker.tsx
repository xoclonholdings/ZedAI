import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUpRight, Check, ChevronDown, Workflow } from "lucide-react";

import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";
import type { AgentTarget, ConversationMode } from "@shared/schema";

import { LANE_OPTIONS, type LaneOption } from "./lanes";

/**
 * Lane chip + dropdown menu shown inside the composer. Owns its own
 * open state and click-outside dismissal so the composer parent
 * doesn't need to track those.
 *
 * Picking a lane bubbles up through onPick with the full option — the
 * parent decides whether to update mode, agent, or both.
 */
export function LanePicker({
  currentMode,
  agentTarget,
  onPick,
}: {
  currentMode: ConversationMode;
  agentTarget: AgentTarget;
  onPick: (option: LaneOption) => void;
}) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const activeLane =
    currentMode === "chat"
      ? LANE_OPTIONS[0]
      : LANE_OPTIONS.find((l) => l.agent === agentTarget) || LANE_OPTIONS[1];

  return (
    <div ref={ref} className="relative shrink-0 self-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-2.5 text-xs font-medium transition-colors max-w-[140px] ${
          currentMode === "agent"
            ? "bg-purple-500/15 text-purple-100 hover:bg-purple-500/25"
            : "bg-white/5 text-foreground hover:bg-white/10"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="composer-lane-chip"
      >
        {currentMode === "agent" && (
          <img src={zLogoPath} alt="" className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate min-w-0">
          {currentMode === "agent" ? activeLane.label : "Chat"}
        </span>
        <ChevronDown size={12} className="opacity-70 shrink-0" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-30 mb-2 w-60 rounded-xl border border-white/10 bg-black/95 p-1 shadow-2xl backdrop-blur"
        >
          {LANE_OPTIONS.map((opt) => {
            const isActive =
              (opt.mode === "chat" && currentMode === "chat") ||
              (opt.mode === "agent" &&
                currentMode === "agent" &&
                opt.agent === agentTarget);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  onPick(opt);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  isActive ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
                    isActive
                      ? "border-cyan-400/60 bg-cyan-400/20"
                      : "border-white/15 bg-transparent"
                  }`}
                >
                  {isActive && <Check size={10} className="m-auto mt-0.5 text-cyan-200" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground">
                    {opt.mode === "agent" ? `Agent · ${opt.label}` : opt.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight">
                    {opt.blurb}
                  </div>
                </div>
              </button>
            );
          })}

          <div className="my-1 border-t border-white/10" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/flows");
            }}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5"
            data-testid="composer-flow-mode"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Workflow size={13} className="text-cyan-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground">Flow Mode</div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  Pick an outcome — agents coordinate the rest.
                </div>
              </div>
            </div>
            <ArrowUpRight size={12} className="text-muted-foreground shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}
