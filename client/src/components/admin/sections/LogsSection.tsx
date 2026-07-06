import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { SettingGroup, SettingRow, Segmented } from "./settings/atoms";

/**
 * Plain-language Logs surface.
 *
 * Same atoms as Settings/Integrations/Approvals: header, filter,
 * one row per event. Raw event names like "chat.execution.trace"
 * are translated to plain English so a non-engineer can browse.
 */

type RuntimeLevel = "info" | "warn" | "error";
interface RuntimeEvent {
  timestamp: string;
  level: RuntimeLevel;
  source: "server" | "client";
  event: string;
  detail?: string;
  context?: Record<string, unknown>;
}

type Filter = "errors" | "warnings" | "activity" | "routing" | "all";

const FILTER_OPTIONS: Array<{ value: Filter; label: string }> = [
  { value: "errors", label: "Errors" },
  { value: "warnings", label: "Warnings" },
  { value: "activity", label: "Activity" },
  { value: "routing", label: "Routing" },
  { value: "all", label: "All" },
];

// Translate raw event keys → plain-English summaries. Anything not
// in the map falls through to a mildly-friendly version of the raw
// key (dots become spaces, first-letter uppercased).
const EVENT_LABEL: Record<string, string> = {
  "chat.execution.trace": "Chat request completed",
  "chat.execution.failed": "Chat request failed",
  "trace.validation.violation": "Trace was incomplete",
  "self_repair.outcome": "Auto-repair attempt",
  "http.response": "Request returned an error",
  "auth.login.success": "You signed in",
  "auth.login.fail": "Sign-in failed",
  "auth.session_expired": "Session expired",
  "auth.lockout": "Sign-in locked",
  "approval.queued": "Waiting for your approval",
  "approval.approved": "You approved something",
  "approval.rejected": "You rejected something",
  "policy.external_api.consulted": "Zed checked policy before calling out",
  "policy.external_api.denied": "Policy blocked an outbound call",
  "subsystem.priority.classify": "Priority classifier ran",
  "subsystem.scheduler.schedule": "Deferred action scheduled",
  "subsystem.scheduler.tick": "Scheduler ran a tick",
  "subsystem.inbox.inspect": "Inbox watchdog ran",
  "subsystem.meeting.follow_up": "Meeting follow-up drafted",
  "subsystem.scheduling.prepare": "Scheduling draft prepared",
  "subsystem.drafting.voice": "Voice-matched draft prepared",
  "subsystem.omnichannel.append": "Something added to memory",
  "subsystem.orchestrator.run": "Tool orchestrator ran",
};

function friendlyEvent(evt: string): string {
  return EVENT_LABEL[evt] || evt.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function friendlyTime(t: string): string {
  try {
    const d = new Date(t);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return d.toLocaleString();
  } catch {
    return t;
  }
}

const ACTIVITY_LEVELS: RuntimeLevel[] = ["info"];

export default function LogsSection() {
  const [routing, setRouting] = useState<string[]>([]);
  const [runtime, setRuntime] = useState<RuntimeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("errors");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/logs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRouting(data.entries || []);
        setRuntime((data.runtime || []) as RuntimeEvent[]);
      }
    } catch {
      /* silent — refresh will re-fetch */
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchLogs();
    const interval = window.setInterval(fetchLogs, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const counts = useMemo(
    () => ({
      errors: runtime.filter((e) => e.level === "error").length,
      warnings: runtime.filter((e) => e.level === "warn").length,
      activity: runtime.filter((e) => ACTIVITY_LEVELS.includes(e.level)).length,
      routing: routing.length,
      all: runtime.length,
    }),
    [routing.length, runtime],
  );

  const visible = useMemo(() => {
    if (filter === "errors") return [...runtime.filter((e) => e.level === "error")].reverse();
    if (filter === "warnings") return [...runtime.filter((e) => e.level === "warn")].reverse();
    if (filter === "activity")
      return [...runtime.filter((e) => ACTIVITY_LEVELS.includes(e.level))].reverse();
    if (filter === "all") return [...runtime].reverse();
    return [];
  }, [runtime, filter]);

  function toggle(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Activity & errors
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-[62ch] leading-snug">
            A running feed of what Zed did and what went wrong. Errors go to the top of the list. Tap any row to see the details.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <Segmented<Filter>
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter logs"
        />
        <div className="text-[12.5px] text-white/40">
          {counts.errors} errors · {counts.warnings} warnings · {counts.activity} activity
        </div>
      </div>

      {filter === "routing" ? (
        <RoutingList entries={routing} loading={loading} />
      ) : loading && visible.length === 0 ? (
        <div className="text-center text-[13.5px] text-white/50 py-12">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-[13.5px] text-white/45">
          Nothing to show in this view.
        </div>
      ) : (
        <SettingGroup title={FILTER_OPTIONS.find((f) => f.value === filter)?.label || "Events"}>
          {visible.map((evt, idx) => {
            const hasContext = evt.context && Object.keys(evt.context).length > 0;
            const isOpen = expanded.has(idx);
            return (
              <SettingRow
                key={`${evt.timestamp}-${idx}`}
                label={friendlyEvent(evt.event)}
                description={`${friendlyTime(evt.timestamp)}${evt.detail ? ` · ${evt.detail}` : ""}${hasContext && isOpen ? `\n\n${JSON.stringify(evt.context, null, 2)}` : ""}`}
                stack={isOpen && hasContext}
              >
                {evt.level === "error" ? (
                  <span className="inline-flex rounded-full bg-red-400/15 text-red-300 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.06em]">
                    error
                  </span>
                ) : evt.level === "warn" ? (
                  <span className="inline-flex rounded-full bg-yellow-400/15 text-yellow-300 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.06em]">
                    warning
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-cyan-400/10 text-cyan-300/80 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.06em]">
                    info
                  </span>
                )}
                {hasContext && (
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    className="ml-2 text-[11.5px] text-white/50 hover:text-white/80 underline underline-offset-2"
                  >
                    {isOpen ? "hide details" : "details"}
                  </button>
                )}
              </SettingRow>
            );
          })}
        </SettingGroup>
      )}
    </div>
  );
}

function RoutingList({ entries, loading }: { entries: string[]; loading: boolean }) {
  if (loading) {
    return <div className="text-center text-[13.5px] text-white/50 py-12">Loading…</div>;
  }
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-[13.5px] text-white/45">
        No routing history yet. Send an agent-routed message to generate entries.
      </div>
    );
  }
  return (
    <SettingGroup title="Routing">
      {[...entries].reverse().slice(0, 100).map((raw, i) => {
        let parsed: any = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          /* raw line, treat as string */
        }
        const label = parsed.agent
          ? `Routed to ${parsed.agent}`
          : String(raw).slice(0, 80);
        const time = parsed.timestamp ? friendlyTime(parsed.timestamp) : "";
        const detail = parsed.conversationId
          ? `Conversation ${String(parsed.conversationId).slice(0, 8)}`
          : "";
        return (
          <SettingRow key={i} label={label} description={`${time}${detail ? ` · ${detail}` : ""}`}>
            <span className="text-[11.5px] text-white/40">
              {parsed.messageLength ? `${parsed.messageLength} chars` : ""}
            </span>
          </SettingRow>
        );
      })}
    </SettingGroup>
  );
}
