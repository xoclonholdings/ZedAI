import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, RefreshCw, RotateCcw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { FlowRun } from "../../../../shared/flow-types";
import { RUN_STATUS_STYLE } from "./styles";
import { StageCard } from "./StageCard";

function statusLabel(status: FlowRun["status"]): string {
  if (status === "awaiting_approval") return "Waiting for Approval";
  return status.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function canCancel(status: FlowRun["status"]): boolean {
  return status === "queued" || status === "running" || status === "awaiting_approval";
}

export function RunDetailPage() {
  const [, navigate] = useLocation();
  const { runId } = useParams<{ runId?: string }>();
  const [run, setRun] = useState<FlowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<"approve" | "reject" | "retry" | "cancel" | null>(null);

  async function fetchRun() {
    if (!runId) return;
    try {
      const res = await fetch(`/api/flows/runs/${runId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FlowRun;
      setRun(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load history item");
    } finally {
      setLoading(false);
    }
  }

  async function postAction(action: "approve" | "reject" | "retry" | "cancel", body: Record<string, unknown> = {}) {
    if (!runId) return;
    setActionPending(action);
    try {
      const res = await fetch(`/api/flows/runs/${runId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      await fetchRun();
    } catch (e: any) {
      setError(e?.message || `Failed to ${action}`);
    } finally {
      setActionPending(null);
    }
  }

  async function approve() {
    await postAction("approve");
  }

  async function reject() {
    const reason = window.prompt("Reason for rejecting? (optional)") ?? "";
    await postAction("reject", { reason });
  }

  async function retry() {
    await postAction("retry");
  }

  async function cancel() {
    const reason = window.prompt("Reason for cancelling? (optional)") ?? "";
    await postAction("cancel", { reason });
  }

  useEffect(() => {
    void fetchRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useEffect(() => {
    if (!run) return;
    const live = run.status === "queued" || run.status === "running" || run.status === "awaiting_approval";
    if (!live) return;
    const interval = window.setInterval(() => {
      void fetchRun();
    }, 3000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.status]);

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
        <span className="max-w-[60vw] truncate font-medium">{run?.flowName || "History Item"}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchRun}
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

        {loading && !run ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !run ? (
          <div className="py-12 text-center text-sm text-muted-foreground">History item not found.</div>
        ) : (
          <>
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={`border text-[10px] uppercase tracking-[0.16em] ${RUN_STATUS_STYLE[run.status]}`}>
                  {statusLabel(run.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Started {new Date(run.startedAt).toLocaleString()}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold">{run.flowName}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {run.progressPct}% complete - {run.estimatedRemainingWork}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Activity ID <span className="font-mono">{run.id.slice(0, 8)}</span>
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {run.status === "failed" && (
                  <Button size="sm" onClick={retry} disabled={actionPending !== null} className="rounded-xl">
                    <RotateCcw size={14} className="mr-1" />
                    {actionPending === "retry" ? "Retrying..." : "Retry"}
                  </Button>
                )}
                {canCancel(run.status) && (
                  <Button size="sm" variant="outline" onClick={cancel} disabled={actionPending !== null} className="rounded-xl border-red-500/40 text-red-200 zed-glass">
                    <XCircle size={14} className="mr-1" />
                    {actionPending === "cancel" ? "Cancelling..." : "Cancel"}
                  </Button>
                )}
              </div>
            </section>

            {run.status === "awaiting_approval" && (
              <div className="space-y-2 rounded-xl border border-purple-500/30 bg-purple-500/5 p-3">
                <p className="text-sm font-medium text-purple-200">
                  This item needs approval before ZED can continue.
                </p>
                <div className="flex gap-2">
                  <Button onClick={approve} disabled={actionPending !== null} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700">
                    {actionPending === "approve" ? "Approving..." : "Approve & Continue"}
                  </Button>
                  <Button onClick={reject} disabled={actionPending !== null} variant="outline" className="zed-glass border-red-500/40 text-red-200">
                    {actionPending === "reject" ? "Rejecting..." : "Reject"}
                  </Button>
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Progress</p>
              <div className="space-y-2">
                {run.stageRuns.map((sr, idx) => (
                  <StageCard key={sr.stageId} stageRun={sr} index={idx} />
                ))}
              </div>
            </div>

            {run.report && (
              <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Report</div>
                <h2 className="mt-2 text-lg font-semibold">{run.report.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{run.report.executiveSummary}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ReportList title="Key Points" items={run.report.keyFindings} />
                  <ReportList title="Decisions" items={run.report.decisions} />
                  <ReportList title="Actions" items={run.report.actionsTaken} />
                  <ReportList title="Next Steps" items={run.report.recommendedNextSteps} />
                </div>
              </section>
            )}

            {run.errors.length > 0 && (
              <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-red-200">Errors</div>
                <div className="mt-3 space-y-2">
                  {run.errors.map((err) => (
                    <div key={err.id} className="rounded-xl border border-red-500/20 bg-black/30 p-3 text-xs text-red-100">
                      <div>{err.message}</div>
                      <div className="mt-1 text-red-200/60">{new Date(err.timestamp).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {Object.keys(run.context).length > 0 && (
              <details className="rounded-lg border border-white/10 bg-black/20 p-3">
                <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Context
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

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
        {items.length ? items.map((item, index) => <div key={`${title}-${index}`}>- {item}</div>) : <div>No items recorded.</div>}
      </div>
    </div>
  );
}
