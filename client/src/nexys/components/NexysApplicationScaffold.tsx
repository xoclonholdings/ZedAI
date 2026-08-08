import { ArrowUpRight, Database, GitBranch, ShieldCheck, type LucideIcon } from "lucide-react";
import { useLocation } from "wouter";

import type { NexysApplicationBoundary } from "../apps/types";
import type { NexysNodeDefinition } from "../graph/types";
import { NexysIcon } from "./NexysIcon";

export function NexysApplicationScaffold({
  node,
  boundary,
}: {
  readonly node: NexysNodeDefinition;
  readonly boundary: NexysApplicationBoundary;
}) {
  const [, navigate] = useLocation();
  const visual = node.metadata.visual;

  return (
    <section className="border-t border-white/10 bg-white/[0.025]">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 md:grid-cols-[1fr_0.72fr] md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10"
              style={{ color: visual.color, backgroundColor: `${visual.color}12` }}
            >
              <NexysIcon name={visual.icon} size={21} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                {boundary.status}
              </div>
              <h1 className="truncate text-xl font-semibold text-white">{node.metadata.title}</h1>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/62">
            {node.metadata.summary}
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <BoundaryFact icon={GitBranch} label="Route" value={boundary.basePath} />
            <BoundaryFact icon={Database} label="State" value={boundary.stateNamespace} />
            <BoundaryFact icon={ShieldCheck} label="Core" value="ZAR Core consumer" />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Boundary Contract
          </div>
          <div className="mt-3 space-y-2">
            {boundary.notes.map((note) => (
              <div key={note} className="rounded-md border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[12.5px] text-white/62">
                {note}
              </div>
            ))}
          </div>
          {boundary.currentSurfacePath && (
            <button
              type="button"
              onClick={() => navigate(boundary.currentSurfacePath!)}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 py-2 text-[12px] font-medium text-cyan-100 hover:bg-cyan-300/[0.14]"
            >
              Current surface
              <ArrowUpRight size={13} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function BoundaryFact({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3">
      <Icon size={14} className="text-cyan-200/80" />
      <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.38]">{label}</div>
      <div className="mt-1 truncate text-[12.5px] font-medium text-white/78">{value}</div>
    </div>
  );
}
