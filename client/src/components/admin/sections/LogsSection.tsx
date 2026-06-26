import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, GitBranch, Info, RefreshCw, ServerCrash } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type RuntimeLevel = "info" | "warn" | "error";
interface RuntimeEvent {
  timestamp: string;
  level: RuntimeLevel;
  source: "server" | "client";
  event: string;
  detail?: string;
  context?: Record<string, unknown>;
}

type Filter = "all" | "errors" | "warnings" | "routing";

const LEVEL_STYLE: Record<RuntimeLevel, { icon: any; cls: string }> = {
  error: { icon: AlertCircle, cls: "text-red-300" },
  warn: { icon: AlertTriangle, cls: "text-yellow-300" },
  info: { icon: Info, cls: "text-cyan-300" },
};

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
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    void fetchLogs();
    const interval = window.setInterval(fetchLogs, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const counts = useMemo(
    () => ({
      all: runtime.length,
      errors: runtime.filter((e) => e.level === "error").length,
      warnings: runtime.filter((e) => e.level === "warn").length,
      routing: routing.length,
    }),
    [routing.length, runtime],
  );

  const visibleRuntime = (() => {
    if (filter === "errors") return runtime.filter((e) => e.level === "error");
    if (filter === "warnings") return runtime.filter((e) => e.level === "warn");
    if (filter === "routing") return [];
    return runtime;
  })();
  const visibleRuntimeReversed = [...visibleRuntime].reverse();

  function toggleExpanded(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Logs</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Inspect failed requests, runtime errors, warnings, and agent-routing activity from the existing diagnostics feed.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="zed-button text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <LogStatCard
          label="Errors"
          value={counts.errors}
          active={filter === "errors"}
          icon={ServerCrash}
          tone="error"
          onClick={() => setFilter("errors")}
        />
        <LogStatCard
          label="Warnings"
          value={counts.warnings}
          active={filter === "warnings"}
          icon={AlertTriangle}
          tone="warn"
          onClick={() => setFilter("warnings")}
        />
        <LogStatCard
          label="Routing"
          value={counts.routing}
          active={filter === "routing"}
          icon={GitBranch}
          onClick={() => setFilter("routing")}
        />
        <LogStatCard
          label="All Runtime"
          value={counts.all}
          active={filter === "all"}
          icon={Info}
          onClick={() => setFilter("all")}
        />
      </div>

      {filter === "routing" ? (
        <RoutingLogList entries={routing} loading={loading} />
      ) : visibleRuntimeReversed.length === 0 ? (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {loading ? "Loading…" : "No events match this view."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {visibleRuntimeReversed.map((evt, idx) => {
            const style = LEVEL_STYLE[evt.level] || LEVEL_STYLE.info;
            const Icon = style.icon;
            const hasContext = evt.context && Object.keys(evt.context).length > 0;
            const isExpanded = expanded.has(idx);
            const time = (() => {
              try {
                return new Date(evt.timestamp).toLocaleTimeString();
              } catch {
                return evt.timestamp;
              }
            })();
            return (
              <button
                key={`${evt.timestamp}-${idx}`}
                type="button"
                onClick={() => hasContext && toggleExpanded(idx)}
                className={`w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2 ${
                  hasContext ? "cursor-pointer hover:bg-white/10" : "cursor-default"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Icon size={14} className={`mt-0.5 shrink-0 ${style.cls}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground">{time}</span>
                      <Badge
                        variant="secondary"
                        className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
                      >
                        {evt.source}
                      </Badge>
                      <span className={`font-mono font-medium ${style.cls}`}>{evt.event}</span>
                    </div>
                    {evt.detail && (
                      <p className="mt-1 text-xs leading-5 text-foreground/80 break-words">
                        {evt.detail}
                      </p>
                    )}
                    {hasContext && isExpanded && (
                      <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 text-[10px] text-foreground/70">
                        {JSON.stringify(evt.context, null, 2)}
                      </pre>
                    )}
                    {hasContext && !isExpanded && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        tap to expand context
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LogStatCard({
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
  tone?: "error" | "warn";
  onClick: () => void;
}) {
  const toneClass = tone === "error" ? "text-red-300" : tone === "warn" ? "text-yellow-300" : "text-cyan-300";
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

function RoutingLogList({ entries, loading }: { entries: string[]; loading: boolean }) {
  if (loading) {
    return (
      <Card className="zed-glass border-white/10">
        <CardContent className="py-12 text-center text-muted-foreground text-sm">Loading…</CardContent>
      </Card>
    );
  }
  if (entries.length === 0) {
    return (
      <Card className="zed-glass border-white/10">
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No agent routing logs yet. Send an agent-routed message to generate entries.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-1 font-mono">
      {[...entries].reverse().map((entry, i) => {
        let parsed: any = {};
        try {
          parsed = JSON.parse(entry);
        } catch {}
        return (
          <div key={i} className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5">
            <span className="text-muted-foreground">
              {parsed.timestamp ? new Date(parsed.timestamp).toLocaleTimeString() : ""}
            </span>
            <span className="mx-2 text-purple-400 font-medium">{parsed.agent || "—"}</span>
            <span className="text-foreground/70">
              {parsed.conversationId ? `conv:${String(parsed.conversationId).slice(0, 8)}` : ""}
            </span>
            {parsed.messageLength && (
              <span className="ml-2 text-muted-foreground">{parsed.messageLength} chars</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
