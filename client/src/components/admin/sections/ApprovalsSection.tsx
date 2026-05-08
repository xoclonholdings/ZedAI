import { useEffect } from "react";
import { CheckCircle, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";

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
  useEffect(() => {
    onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Approval Queue</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Actions flagged by agents that require your sign-off before execution.
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

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : approvals.length === 0 ? (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <CheckCircle size={32} className="mx-auto mb-3 text-green-400/50" />
            No items in the approval queue.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {approvals.map((entry) => (
            <Card
              key={entry.id}
              className={`zed-glass border-white/10 ${
                entry.status === "approved"
                  ? "border-green-500/30"
                  : entry.status === "rejected"
                    ? "border-red-500/20 opacity-60"
                    : "border-yellow-500/30"
              }`}
            >
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        className={`text-[10px] ${
                          entry.status === "pending"
                            ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                            : entry.status === "approved"
                              ? "bg-green-500/20 text-green-300 border-green-500/30"
                              : "bg-red-500/20 text-red-300 border-red-500/30"
                        }`}
                      >
                        {entry.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {entry.agent} · {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground/90 truncate">
                      {entry.message}
                    </p>
                    {entry.draft && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        Draft: {entry.draft}
                      </p>
                    )}
                    {entry.rejectionReason && (
                      <p className="text-xs text-red-400 mt-1">
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
    </>
  );
}
