import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  RefreshCw,
  XCircle,
  Workflow,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type {
  FlowRun,
  FlowRunStatus,
  FlowStageRunStatus,
} from "../../../shared/flow-types";

const RUN_STATUS_STYLE: Record<FlowRunStatus, string> = {
  queued: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  running: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
  awaiting_approval: "bg-purple-500/15 text-purple-200 border-purple-500/30",
  completed: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-200 border-red-500/30",
  cancelled: "bg-white/5 text-muted-foreground border-white/10",
};

const STAGE_ICON: Record<FlowStageRunStatus, any> = {
  pending: Clock,
  running: RefreshCw,
  awaiting_approval: AlertCircle,
  completed: CheckCircle2,
  skipped: XCircle,
  failed: XCircle,
};

const STAGE_TONE: Record<FlowStageRunStatus, string> = {
  pending: "text-muted-foreground",
  running: "text-cyan-300",
  awaiting_approval: "text-purple-300",
  completed: "text-emerald-300",
  skipped: "text-muted-foreground/60",
  failed: "text-red-300",
};

/** Convert "s1-opportunity-detection" → "Opportunity Detection". */
function prettifyStageId(id: string): string {
  return id
    .replace(/^s\d+-/, "")
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}

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

  // Poll while the run is still progressing
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
        <span className="font-medium truncate max-w-[60vw]">
          {run?.flowName || "Run"}
        </span>
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
          <div className="text-center text-muted-foreground py-12 text-sm">
            Run not found.
          </div>
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
                {run.stageRuns.map((sr, idx) => {
                  const Icon = STAGE_ICON[sr.status];
                  const tone = STAGE_TONE[sr.status];
                  const stageName = prettifyStageId(sr.stageId);
                  const output =
                    typeof sr.output === "string"
                      ? sr.output
                      : sr.output
                        ? JSON.stringify(sr.output, null, 2)
                        : null;
                  return (
                    <Card key={sr.stageId} className="zed-glass border-white/10">
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <Icon
                            size={13}
                            className={`shrink-0 ${tone} ${sr.status === "running" ? "animate-spin" : ""}`}
                          />
                          <span className={`text-sm font-medium flex-1 truncate ${tone}`}>
                            {stageName}
                          </span>
                          <Badge
                            variant="secondary"
                            className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
                          >
                            {sr.status.replace("_", " ")}
                          </Badge>
                        </div>
                        {sr.notes && (
                          <p className="text-[11px] text-muted-foreground leading-5">
                            {sr.notes}
                          </p>
                        )}
                        {sr.error && (
                          <p className="text-[11px] text-red-300 leading-5">{sr.error}</p>
                        )}
                        {output && sr.status === "completed" && (
                          <details className="pt-1">
                            <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
                              View output
                            </summary>
                            <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-6 zed-markdown">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {output}
                              </ReactMarkdown>
                            </div>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
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
