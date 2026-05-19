import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { FlowRun } from "../../../../shared/flow-types";
import { RUN_STATUS_STYLE } from "./styles";
import { StageCard } from "./StageCard";

export function RunDetailPage() {
  const [, navigate] = useLocation();
  const { runId } = useParams<{ runId?: string }>();
  const [run, setRun] = useState<FlowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<"approve" | "reject" | null>(null);

  async function fetchRun() {
    if (!runId) return;
    try {
      const res = await fetch(`/api/flows/runs/${runId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FlowRun;
      setRun(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load run");
    } finally {
      setLoading(false);
    }
  }

  async function approve() {
    if (!runId) return;
    setActionPending("approve");
    try {
      const res = await fetch(`/api/flows/runs/${runId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchRun();
    } catch (e: any) {
      setError(e?.message || "Failed to approve");
    } finally {
      setActionPending(null);
    }
  }

  async function reject() {
    if (!runId) return;
    const reason = window.prompt("Reason for rejecting? (optional)") ?? "";
    setActionPending("reject");
    try {
      const res = await fetch(`/api/flows/runs/${runId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchRun();
    } catch (e: any) {
      setError(e?.message || "Failed to reject");
    } finally {
      setActionPending(null);
    }
  }

  useEffect(() => {
    void fetchRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useEffect(() => {
    if (!run) return;
    const live =
      run.status === "queued" ||
      run.status === "running" ||
      run.status === "awaiting_approval";
    if (!live) return;
    const interval = window.setInterval(() => {
      void fetchRun();
    }, 3000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.status]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 zed-glass px-4 pb-3 pt-safe-sm flex items-center justify-between sticky top-0 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/runs")}
          className="text-muted-foreground hover:text-foreground zed-button rounded-xl"
        >
          <ChevronLeft size={16} className="mr-1" />
          Runs
        </Button>
        <span className="font-medium truncate max-w-[60vw]">{run?.flowName || "Run"}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchRun}
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

        {loading && !run ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Loading…</div>
        ) : !run ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Run not found.</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={`border text-[10px] uppercase tracking-[0.16em] ${RUN_STATUS_STYLE[run.status]}`}
              >
                {run.status.replace("_", " ")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Started {new Date(run.startedAt).toLocaleString()}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Run id <span className="font-mono">{run.id.slice(0, 8)}</span> · flow{" "}
              <span className="font-mono">{run.flowSlug}</span>
            </p>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Stages
              </p>
              {run.status === "awaiting_approval" && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-2">
                  <p className="text-sm font-medium text-purple-200">
                    This stage requires your approval before the next stage can run.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={approve}
                      disabled={actionPending !== null}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {actionPending === "approve" ? "Approving…" : "Approve & continue"}
                    </Button>
                    <Button
                      onClick={reject}
                      disabled={actionPending !== null}
                      variant="outline"
                      className="zed-glass border-red-500/40 text-red-200"
                    >
                      {actionPending === "reject" ? "Rejecting…" : "Reject"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {run.stageRuns.map((sr, idx) => (
                  <StageCard key={sr.stageId} stageRun={sr} index={idx} />
                ))}
              </div>
            </div>

            {Object.keys(run.context).length > 0 && (
              <details className="rounded-lg border border-white/10 bg-black/20 p-3">
                <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Shared context (blackboard)
                </summary>
                <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 text-[10px] text-foreground/70">
                  {JSON.stringify(run.context, null, 2)}
                </pre>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
