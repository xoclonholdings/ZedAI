import { useEffect, useMemo } from "react";
import { ArrowRight, GitBranch, Layers, RadioTower, type LucideIcon } from "lucide-react";
import { useLocation, useParams } from "wouter";

import { getNexusApplicationBoundary } from "../apps/rootApplications";
import { NexusApplicationScaffold } from "../components/NexusApplicationScaffold";
import { NexusConstellation } from "../components/NexusConstellation";
import { NexusIcon } from "../components/NexusIcon";
import { isNexusRootNodeId } from "../graph/rootConstellation";
import { useNexus } from "../state/NexusProvider";

export default function NexusRootPage() {
  const params = useParams<{ nodeId?: string }>();
  const [, navigate] = useLocation();
  const { snapshot, activateNode, toggleNode } = useNexus();
  const routeNodeId = isNexusRootNodeId(params.nodeId) ? params.nodeId : null;
  const hasUnknownRouteNode = Boolean(params.nodeId && !routeNodeId);

  useEffect(() => {
    if (routeNodeId) activateNode(routeNodeId);
  }, [activateNode, routeNodeId]);

  useEffect(() => {
    if (hasUnknownRouteNode) navigate("/nexus");
  }, [hasUnknownRouteNode, navigate]);

  const activeNode = useMemo(
    () => (routeNodeId ? snapshot.nodes.find((node) => node.id === routeNodeId) ?? snapshot.activeNode : snapshot.activeNode),
    [routeNodeId, snapshot.activeNode, snapshot.nodes],
  );
  const boundary = activeNode && isNexusRootNodeId(activeNode.id)
    ? getNexusApplicationBoundary(activeNode.id)
    : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/90 px-4 pb-3 pt-safe-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">
              ZAR
            </div>
            <div className="truncate text-[16px] font-semibold">Nexus Constellation</div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/chat")}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white/72 hover:border-white/20 hover:text-white"
          >
            Create
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_360px] md:px-6">
          <div className="min-w-0">
            <NexusConstellation />
          </div>

          <aside className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-200/20 bg-cyan-200/[0.07] text-cyan-100">
                  <Layers size={18} />
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-white">Root Graph</div>
                  <div className="text-[11px] text-white/45">
                    {snapshot.rootNodes.length} roots, {snapshot.connections.length} links
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric icon={GitBranch} label="Expanded" value={snapshot.expandedNodeIds.length} />
                <Metric icon={RadioTower} label="Trail" value={snapshot.navigationTrail.length} />
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/[0.42]">
                Roots
              </div>
              <div className="grid gap-1.5">
                {snapshot.rootNodes.map((node) => {
                  const active = activeNode?.id === node.id;
                  const expanded = snapshot.expandedNodeIds.includes(node.id);
                  return (
                    <div
                      key={node.id}
                      className={`grid grid-cols-[1fr_34px] items-center rounded-md border ${
                        active ? "border-cyan-200/40 bg-cyan-200/[0.08]" : "border-white/[0.07] bg-black/20"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          activateNode(node.id);
                          navigate(node.metadata.route);
                        }}
                        className="flex min-w-0 items-center gap-2 px-2.5 py-2 text-left"
                      >
                        <NexusIcon name={node.metadata.visual.icon} size={14} className="shrink-0" />
                        <span className="truncate text-[12.5px] font-medium text-white/[0.82]">{node.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleNode(node.id)}
                        className="h-full border-l border-white/[0.07] text-[11px] text-white/[0.48] hover:text-white"
                        aria-label={`${expanded ? "Collapse" : "Expand"} ${node.label}`}
                      >
                        {expanded ? "-" : "+"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </section>

        {activeNode && boundary && (
          <NexusApplicationScaffold node={activeNode} boundary={boundary} />
        )}
      </main>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="rounded-md border border-white/[0.07] bg-black/25 px-2.5 py-2">
      <Icon size={13} className="text-cyan-200/75" />
      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</div>
      <div className="text-[14px] font-semibold text-white">{value}</div>
    </div>
  );
}
