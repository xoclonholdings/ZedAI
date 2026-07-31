import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  FolderKanban,
  Gavel,
  GitBranch,
  Heart,
  HelpCircle,
  Plug,
  RefreshCw,
  ScrollText,
  Server,
  ShieldAlert,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cleanSummary, cleanTitle } from "@/lib/text";
import type {
  AnyMemoryObject,
  ObjectGraph,
  ObjectMemoryType,
} from "@shared/object-memory-types";

/**
 * Timeline — evolution view of the object graph.
 *
 * Every object sorted by updatedAt, grouped by day. Filter chips
 * restrict to a single type. Reads the applied graph — no new data.
 */

const TYPE_ICON: Record<ObjectMemoryType, LucideIcon> = {
  user_profile: User,
  project: FolderKanban,
  system: Server,
  feature: Sparkles,
  decision: Gavel,
  preference: Heart,
  rule: ScrollText,
  constraint: ShieldAlert,
  open_question: HelpCircle,
  task: CheckSquare,
  integration: Plug,
  repository: GitBranch,
  event: CalendarClock,
  memory_conflict: AlertTriangle,
};

const TYPE_LABEL: Record<ObjectMemoryType, string> = {
  user_profile: "Profile",
  project: "Project",
  system: "System",
  feature: "Feature",
  decision: "Decision",
  preference: "Preference",
  rule: "Rule",
  constraint: "Constraint",
  open_question: "Question",
  task: "Task",
  integration: "Integration",
  repository: "Repository",
  event: "Event",
  memory_conflict: "Conflict",
};

function dayBucket(iso: string): { key: string; label: string } {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    const key = d.toISOString().slice(0, 10);
    if (sameDay(d, today)) return { key, label: "Today" };
    if (sameDay(d, yesterday)) return { key, label: "Yesterday" };
    return {
      key,
      label: d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
      }),
    };
  } catch {
    return { key: "unknown", label: "Undated" };
  }
}

function timeOfDay(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function TimelinePage() {
  const [, navigate] = useLocation();
  const [graph, setGraph] = useState<ObjectGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ObjectMemoryType | "all">("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/memory/graph", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGraph(await res.json());
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const objects = useMemo<AnyMemoryObject[]>(() => graph?.objects || [], [graph]);

  const availableTypes = useMemo(() => {
    const set = new Set<ObjectMemoryType>();
    for (const o of objects) set.add(o.type);
    return Array.from(set).sort();
  }, [objects]);

  const filtered = useMemo(() => {
    const list = filter === "all" ? objects : objects.filter((o) => o.type === filter);
    return [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [objects, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: AnyMemoryObject[] }>();
    for (const o of filtered) {
      const b = dayBucket(o.updatedAt);
      if (!map.has(b.key)) map.set(b.key, { label: b.label, items: [] });
      map.get(b.key)!.items.push(o);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <main className="mx-auto max-w-3xl space-y-4">
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-xl text-muted-foreground hover:text-foreground zar-button"
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            <CalendarClock size={14} />
            Evolution
          </div>
          <h1 className="mt-2 text-2xl font-semibold">How things have progressed</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Everything ZAR has learned or updated, most recent first. Focus on progress rather
            than chat logs.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {availableTypes.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <FilterChip
              label="All"
              active={filter === "all"}
              onClick={() => setFilter("all")}
              count={objects.length}
            />
            {availableTypes.map((t) => {
              const TIcon = TYPE_ICON[t];
              const count = objects.filter((o) => o.type === t).length;
              return (
                <FilterChip
                  key={t}
                  label={TYPE_LABEL[t]}
                  icon={TIcon}
                  active={filter === t}
                  onClick={() => setFilter(t)}
                  count={count}
                />
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
            Nothing to show yet. As ZAR learns, updates land here in order.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-white/[0.08]" />
            <div className="space-y-6">
              {groups.map(([key, group]) => (
                <section key={key} className="relative">
                  <div className="ml-10 mb-2 text-[11px] uppercase tracking-[0.14em] text-white/45">
                    {group.label}
                  </div>
                  <div className="space-y-2">
                    {group.items.map((o) => {
                      const TIcon = TYPE_ICON[o.type];
                      const href =
                        o.type === "decision"
                          ? `/decisions/${o.id}`
                          : "/learning";
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => navigate(href)}
                          className="w-full flex items-start gap-3 pl-0 pr-3 py-2 text-left group"
                        >
                          <div className="relative shrink-0 w-10 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full border border-white/15 bg-black flex items-center justify-center group-hover:border-cyan-300/60 group-hover:bg-cyan-400/10 transition-colors">
                              <TIcon size={11} className="text-cyan-300/80" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 group-hover:border-white/20 group-hover:bg-white/[0.05] transition-colors">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-medium text-white truncate">
                                {cleanTitle(o.canonicalName, 60)}
                              </span>
                              <span className="text-[10px] uppercase tracking-[0.08em] text-white/40">
                                {TYPE_LABEL[o.type]}
                              </span>
                              <span className="text-[10.5px] text-white/40 ml-auto shrink-0">
                                {timeOfDay(o.updatedAt)}
                              </span>
                            </div>
                            {o.summary && (
                              <div className="mt-1 text-[11.5px] leading-snug text-white/55 line-clamp-2">
                                {cleanSummary(o.summary, 240)}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
    </main>
  );
}

function FilterChip({
  label,
  icon: Icon,
  active,
  onClick,
  count,
}: {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
        active
          ? "border-cyan-400/40 bg-cyan-400/[0.08] text-cyan-100"
          : "border-white/10 bg-white/[0.02] text-white/60 hover:text-white/85 hover:border-white/20"
      }`}
    >
      {Icon && <Icon size={11} />}
      {label}
      {typeof count === "number" && (
        <span className="ml-0.5 text-[10.5px] text-white/45 tabular-nums">{count}</span>
      )}
    </button>
  );
}
