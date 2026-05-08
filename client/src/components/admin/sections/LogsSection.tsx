import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Info, RefreshCw } from "lucide-react";

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
  const [filter, setFilter] = useState<Filter>("all");
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

  const errorCount = runtime.filter((e) => e.level === "error").length;
  const warnCount = runtime.filter((e) => e.level === "warn").length;

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
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Logs</h2>
        <div className="flex items-center gap-2">
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          label={`All (${runtime.length})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterPill
          label={`Errors (${errorCount})`}
          active={filter === "errors"}
          tone="error"
          onClick={() => setFilter("errors")}
        />
        <FilterPill
          label={`Warnings (${warnCount})`}
          active={filter === "warnings"}
          tone="warn"
          onClick={() => setFilter("warnings")}
        />
        <FilterPill
          label={`Routing (${routing.length})`}
          active={filter === "routing"}
          onClick={() => setFilter("routing")}
        />
      </div>

      {filter === "routing" ? (
        <RoutingLogList entries={routing} loading={loading} />
      ) : visibleRuntimeReversed.length === 0 ? (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {loading ? "Loading…" : "No events match this filter."}
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
                      <span className={`font-mono font-medium ${style.cls}`}>
                        {evt.event}
                      </span>
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
    </>
  );
}

function FilterPill({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone?: "error" | "warn";
  onClick: () => void;
}) {
  const activeTone =
    tone === "error"
      ? "bg-red-500/20 text-red-200 border-red-500/30"
      : tone === "warn"
        ? "bg-yellow-500/20 text-yellow-200 border-yellow-500/30"
        : "bg-white/10 text-foreground border-white/20";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? activeTone
          : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function RoutingLogList({
  entries,
  loading,
}: {
  entries: string[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="zed-glass border-white/10">
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Loading…
        </CardContent>
      </Card>
    );
  }
  if (entries.length === 0) {
    return (
      <Card className="zed-glass border-white/10">
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No agent routing logs yet. Send a message in Agent mode to generate entries.
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
          <div
            key={i}
            className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5"
          >
            <span className="text-muted-foreground">
              {parsed.timestamp ? new Date(parsed.timestamp).toLocaleTimeString() : ""}
            </span>
            <span className="mx-2 text-purple-400 font-medium">
              {parsed.agent || "—"}
            </span>
            <span className="text-foreground/70">
              {parsed.conversationId
                ? `conv:${String(parsed.conversationId).slice(0, 8)}`
                : ""}
            </span>
            {parsed.messageLength && (
              <span className="ml-2 text-muted-foreground">
                {parsed.messageLength} chars
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
