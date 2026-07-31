import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  History,
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
import { apiRequest } from "@/lib/queryClient";
import { FlowSuggestionCard, type FlowSuggestion } from "@/components/flows/FlowSuggestionCard";

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
  const queryClient = useQueryClient();

  const loadFlows = async () => {
    try {
      const res = await fetch("/api/flows", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load flows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFlows();
  }, []);

  const { data: suggestionsData } = useQuery<{ suggestions: FlowSuggestion[] }>({
    queryKey: ["/api/flows/suggestions"],
  });
  const suggestions = suggestionsData?.suggestions ?? [];

  const accept = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: { name: string; category: string; blurb: string } }) => {
      const res = await apiRequest("POST", `/api/flows/suggestions/${id}/accept`, input);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/flows/suggestions"] });
      await loadFlows();
    },
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/flows/suggestions/${id}/dismiss`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/flows/suggestions"] });
    },
  });

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">What do you want to do?</h1>
            <p className="text-sm text-muted-foreground">
              Pick an outcome. Flows coordinate the agents, approvals, and outputs for you.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/history")}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11.5px] text-white/70 transition-colors hover:bg-white/[0.06]"
          >
            <History size={13} />
            History
          </button>
        </div>

        {suggestions.map((suggestion) => (
          <FlowSuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            busy={accept.isPending || dismiss.isPending}
            onAccept={(input) => accept.mutate({ id: suggestion.id, input })}
            onDismiss={() => dismiss.mutate(suggestion.id)}
          />
        ))}

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
                      className="zar-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
                    >
                      {flow.stageCount} stage{flow.stageCount === 1 ? "" : "s"}
                    </Badge>
                    {flow.agents.slice(0, 3).map((a) => (
                      <Badge
                        key={a}
                        variant="secondary"
                        className="zar-glass border-purple-500/30 text-purple-200 text-[9px] uppercase tracking-[0.16em]"
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
