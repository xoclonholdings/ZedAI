import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  FileText,
  Users,
  Megaphone,
  Newspaper,
  Rocket,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface PublishedFlow {
  id: string;
  slug: string;
  name: string;
  category: string;
  userFacingLabel: string;
  userFacingBlurb: string;
  icon?: string;
  stageCount: number;
  agents: string[];
}

/** Map the icon string saved on the flow definition back to a lucide component. */
const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  FileText,
  Users,
  Wallet,
  Rocket,
  Megaphone,
  Newspaper,
  ShieldAlert,
  Sparkles,
  Workflow,
};

export default function FlowsPage() {
  const [, navigate] = useLocation();
  const [flows, setFlows] = useState<PublishedFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/flows", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setFlows(data.flows || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load flows");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">What do you want to do?</h1>
          <p className="text-sm text-muted-foreground">
            Pick an outcome. Flows coordinate the agents, approvals, and outputs for you.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Loading…</div>
        ) : flows.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">
            No flows published yet. Ask your admin to publish one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {flows.map((flow) => {
              const Icon = (flow.icon && ICON_MAP[flow.icon]) || Workflow;
              return (
                <button
                  key={flow.id}
                  type="button"
                  onClick={() => navigate(`/flows/${flow.id}`)}
                  className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition-all hover:border-cyan-400/40 hover:bg-white/5 active:scale-[0.99]"
                  data-testid={`flow-tile-${flow.slug}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600/40 to-cyan-500/30 text-cyan-200">
                      <Icon size={16} />
                    </span>
                    <span className="text-base font-semibold text-foreground">
                      {flow.userFacingLabel}
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {flow.userFacingBlurb}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                    <Badge
                      variant="secondary"
                      className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
                    >
                      {flow.stageCount} stage{flow.stageCount === 1 ? "" : "s"}
                    </Badge>
                    {flow.agents.slice(0, 3).map((a) => (
                      <Badge
                        key={a}
                        variant="secondary"
                        className="zed-glass border-purple-500/30 text-purple-200 text-[9px] uppercase tracking-[0.16em]"
                      >
                        {a}
                      </Badge>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}
