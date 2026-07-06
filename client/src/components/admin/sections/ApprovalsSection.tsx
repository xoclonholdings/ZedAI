import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { SettingGroup, SettingRow, Segmented } from "./settings/atoms";

/**
 * Plain-language Approvals surface.
 *
 * Same visual language as Settings and Integrations: header +
 * description, filter as a Segmented, one row per pending item
 * with Approve/Reject inline.
 */

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

const FILTER_OPTIONS: Array<{ value: ApprovalFilter; label: string }> = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function friendlyTime(t: string | number): string {
  try {
    const d = new Date(t);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return d.toLocaleDateString();
  } catch {
    return String(t);
  }
}

function friendlyAgent(agent: string): string {
  const map: Record<string, string> = {
    OperationsAgent: "Operations",
    IntelligenceAgent: "Research",
    BusinessManagerAgent: "Business",
    FinanceAgent: "Finance",
    ManagerAgent: "Zed",
  };
  return map[agent] || agent;
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

  const visible = approvals.filter((entry) =>
    filter === "all" ? true : entry.status === filter,
  );

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Approvals
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-[62ch] leading-snug">
            When Zed wants to do something that needs your OK — send an email, make a payment, publish anywhere — it shows up here first. Approve or reject to release it.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <Segmented<ApprovalFilter>
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter approvals"
        />
        <div className="text-[12.5px] text-white/40">
          {counts.pending} waiting · {counts.approved} approved · {counts.rejected} rejected
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[13.5px] text-white/50 py-12">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-[13.5px] text-white/45">
          Nothing to review in this view.
        </div>
      ) : (
        <SettingGroup title={filter === "pending" ? "Waiting for you" : filter}>
          {visible.map((entry) => (
            <SettingRow
              key={entry.id}
              label={entry.message}
              description={`${friendlyAgent(entry.agent)} · ${friendlyTime(entry.timestamp)}${entry.draft ? `\n\nDraft: ${entry.draft}` : ""}${entry.rejectionReason ? `\nReason: ${entry.rejectionReason}` : ""}`}
              stack={Boolean(entry.draft) || entry.status !== "pending"}
            >
              {entry.status === "pending" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onResolve(entry.id, "reject")}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-red-300 hover:border-red-400/40 transition-colors active:opacity-80"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolve(entry.id, "approve")}
                    className="rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors active:opacity-80"
                  >
                    Approve
                  </button>
                </div>
              ) : (
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.06em] ${
                    entry.status === "approved"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-red-400/15 text-red-300"
                  }`}
                >
                  {entry.status}
                </span>
              )}
            </SettingRow>
          ))}
        </SettingGroup>
      )}
    </div>
  );
}
