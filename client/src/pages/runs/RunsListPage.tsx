import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, RefreshCw, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { FlowRun } from "../../../../shared/flow-types";
import { RUN_STATUS_STYLE } from "./styles";

export function RunsListPage() {
  const [, navigate] = useLocation();
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchRuns() {
    setLoading(true);
    try {
      const res = await fetch("/api/flows/runs", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRuns(data.runs || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRuns();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 zed-glass px-4 pb-3 pt-safe-sm flex items-center justify-between sticky top-0 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/flows")}
          className="text-muted-foreground hover:text-foreground zed-button rounded-xl"
        >
          <ChevronLeft size={16} className="mr-1" />
          Flows
        </Button>
        <div className="flex items-center gap-2">
          <Workflow size={16} className="text-cyan-300" />
          <span className="font-medium">Runs</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchRuns}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground zed-button h-8 w-8 p-0"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-3">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {loading && runs.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">
            No flow runs yet. Pick a flow to start one.
          </div>
        ) : (
          runs.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => navigate(`/runs/${run.id}`)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-left transition-colors hover:bg-white/5"
              data-testid={`run-row-${run.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{run.flowName}</span>
                <Badge
                  variant="secondary"
                  className={`border text-[9px] uppercase tracking-[0.16em] ${RUN_STATUS_STYLE[run.status]}`}
                >
                  {run.status.replace("_", " ")}
                </Badge>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {new Date(run.startedAt).toLocaleString()}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
