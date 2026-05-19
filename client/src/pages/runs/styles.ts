import { AlertCircle, CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";

import type { FlowRunStatus, FlowStageRunStatus } from "../../../../shared/flow-types";

export const RUN_STATUS_STYLE: Record<FlowRunStatus, string> = {
  queued: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  running: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
  awaiting_approval: "bg-purple-500/15 text-purple-200 border-purple-500/30",
  completed: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-200 border-red-500/30",
  cancelled: "bg-white/5 text-muted-foreground border-white/10",
};

export const STAGE_ICON: Record<FlowStageRunStatus, any> = {
  pending: Clock,
  running: RefreshCw,
  awaiting_approval: AlertCircle,
  completed: CheckCircle2,
  skipped: XCircle,
  failed: XCircle,
};

export const STAGE_TONE: Record<FlowStageRunStatus, string> = {
  pending: "text-muted-foreground",
  running: "text-cyan-300",
  awaiting_approval: "text-purple-300",
  completed: "text-emerald-300",
  skipped: "text-muted-foreground/60",
  failed: "text-red-300",
};

/** Convert "s1-opportunity-detection" → "Opportunity Detection". */
export function prettifyStageId(id: string): string {
  return id
    .replace(/^s\d+-/, "")
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}
