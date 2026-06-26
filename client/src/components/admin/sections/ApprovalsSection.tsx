import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Clock3, RefreshCw, ShieldAlert, ThumbsDown, ThumbsUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ApprovalEntry {
  id: string;
  agent: string;
  status: "pending" | "approved" | "rejected";
  message: string;
  draft?: string;
  rejectionReason?: string;
  timestamp: string | number;
  resolvedAt?: string;
}

type ApprovalFilter = "pending" | "approved" | "rejected" | "all";

export default function ApprovalsSection({
  approvals,
  loading,
  onRefresh,
  onResolve,
}: {
  approvals: ApprovalEntry[];
  loading: boolean;
  onRefresh: () => void;
  onResolve: (id: string, action: "approve" | "reject") => void;
}) {
  const [filter, setFilter] = useState<ApprovalFilter>("pending");

  useEffect(() => {
    onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () => ({
      pending: approvals.filter((entry) => entry.status === "pending").length,
      approved: approvals.filter((entry) => entry.status === "approved").length,
      rejected: approvals.filter((entry) => entry.status === "rejected").length,
      all: approvals.length,
    }),
    [approvals],
  );

  const visibleApprovals = approvals.filter((entry) =>
    filter === "all" ? true : entry.status === filter,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Approvals</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Review action requests before ZED performs sensitive work. Internal analysis does not need approval; external actions and risky changes do.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="zed-button text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <ApprovalStatCard
          label="Pending"
          value={counts.pending}
          active={filter === "pending"}
          icon={ShieldAlert}
          tone="pending"
          onClick={() => setFilter("pending")}
        />
        <ApprovalStatCard
          label="Approved"
          value={counts.approved}
          active={filter === "approved"}
          icon={ThumbsUp}
          tone="approved"
          onClick={() => setFilter("approved")}
        />
        <ApprovalStatCard
          label="Rejected"
          value={counts.rejected}
          active={filter === "rejected"}
          icon={ThumbsDown}
          tone="rejected"
          onClick={() => setFilter("rejected")}
        />
        <ApprovalStatCard
          label="All Requests"
          value={counts.all}
          active={filter === "all"}
          icon={Clock3}
          onClick={() => setFilter("all")}
        />
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : visibleApprovals.length === 0 ? (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <CheckCircle size={32} className="mx-auto mb-3 text-green-400/50" />
            No approval items in this view.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleApprovals.map((entry) => (
            <Card
              key={entry.id}
              className={`zed-glass border-white/10 ${
                entry.status === "approved"
                  ? "border-green-500/30"
                  : entry.status === "rejected"
                    ? "border-red-500/20 opacity-70"
                    : "border-yellow-500/30"
              }`}
            >
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={approvalBadgeClass(entry.status)}>{entry.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {entry.agent} · {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground/90">{entry.message}</p>
                    {entry.draft && (
                      <p className="text-xs text-muted-foreground mt-2 leading-5 break-words">
                        Draft: {entry.draft}
                      </p>
                    )}
                    {entry.rejectionReason && (
                      <p className="text-xs text-red-400 mt-2 leading-5">
                        Reason: {entry.rejectionReason}
                      </p>
                    )}
                  </div>
                  {entry.status === "pending" && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => onResolve(entry.id, "approve")}
                        className="h-8 px-3 bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/30"
                        variant="outline"
                      >
                        <ThumbsUp size={12} className="mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onResolve(entry.id, "reject")}
                        className="h-8 px-3 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30"
                        variant="outline"
                      >
                        <ThumbsDown size={12} className="mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function approvalBadgeClass(status: ApprovalEntry["status"]) {
  if (status === "pending") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-[10px]";
  if (status === "approved") return "bg-green-500/20 text-green-300 border-green-500/30 text-[10px]";
  return "bg-red-500/20 text-red-300 border-red-500/30 text-[10px]";
}

function ApprovalStatCard({
  label,
  value,
  active,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  icon: any;
  tone?: "pending" | "approved" | "rejected";
  onClick: () => void;
}) {
  const toneClass =
    tone === "pending"
      ? "text-yellow-300"
      : tone === "approved"
        ? "text-green-300"
        : tone === "rejected"
          ? "text-red-300"
          : "text-cyan-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all ${
        active
          ? "border-cyan-400/35 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]"
          : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-white/10 bg-black/40 p-2">
          <Icon size={15} className={active ? "text-cyan-300" : toneClass} />
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </button>
  );
}
