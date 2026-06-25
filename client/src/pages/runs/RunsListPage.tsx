import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Clock, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { FlowRun } from "../../../../shared/flow-types";
import { RUN_STATUS_STYLE } from "./styles";

function statusLabel(status: FlowRun["status"]): string {
  if (status === "awaiting_approval") return "Waiting for Approval";
  return status.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function RunsListPage() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<FlowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch("/api/flows/runs", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.runs || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe-sm zed-glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/history")}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          History
        </Button>
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-cyan-300" />
          <span className="font-medium">Activity History</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchHistory}
          disabled={loading}
          className="h-8 w-8 rounded-xl p-0 text-muted-foreground hover:text-foreground zed-button"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="mx-auto max-w-3xl space-y-3 p-4 pb-24">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No history yet. Work ZED completes for you will appear here.
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(`/history/${item.id}`)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-left transition-colors hover:bg-white/5"
              data-testid={`history-row-${item.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{item.flowName}</span>
                <Badge variant="secondary" className={`border text-[9px] uppercase tracking-[0.16em] ${RUN_STATUS_STYLE[item.status]}`}>
                  {statusLabel(item.status)}
                </Badge>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{new Date(item.startedAt).toLocaleString()}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
