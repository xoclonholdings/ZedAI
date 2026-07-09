import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  AlertTriangle,
  ChevronLeft,
  Copy,
  HelpCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AnyMemoryObject,
  ObjectGraph,
  ObjectMemoryType,
} from "@shared/object-memory-types";

/**
 * Discovery — surface graph signals that need review.
 *
 * Filter modes reachable from Home's Discovery Feed:
 *  - conflicts       (type === "memory_conflict")
 *  - open-questions  (type === "open_question")
 *  - low-confidence  (confidence < 0.5)
 *  - duplicates      (grouped by canonicalName+type, count > 1)
 *
 * Duplicate groups get a merge action that folds N objects into 1
 * via POST /api/me/memory/merge-objects. Everything else is read-only
 * and links back into the graph.
 */

type Mode = "conflicts" | "open-questions" | "low-confidence" | "duplicates";

const MODES: Array<{
  id: Mode;
  label: string;
  hint: string;
  icon: typeof AlertTriangle;
  accent: "amber" | "cyan" | "fuchsia" | "emerald";
}> = [
  {
    id: "conflicts",
    label: "Conflicts",
    hint: "Two facts Zed can't reconcile.",
    icon: AlertTriangle,
    accent: "amber",
  },
  {
    id: "open-questions",
    label: "Open questions",
    hint: "Things Zed noticed but hasn't answered.",
    icon: HelpCircle,
    accent: "cyan",
  },
  {
    id: "low-confidence",
    label: "Low-confidence",
    hint: "Facts extracted with low certainty. Worth confirming.",
    icon: ShieldAlert,
    accent: "fuchsia",
  },
  {
    id: "duplicates",
    label: "Duplicates",
    hint: "Same object name captured more than once. Merge to consolidate.",
    icon: Copy,
    accent: "emerald",
  },
];

const LOW_CONFIDENCE = 0.5;

function parseMode(search: string): Mode {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const filter = (params.get("filter") || "conflicts") as Mode;
  return MODES.some((m) => m.id === filter) ? filter : "conflicts";
}

interface DuplicateGroup {
  key: string;
  canonicalName: string;
  type: ObjectMemoryType;
  members: AnyMemoryObject[];
}

export default function DiscoveryPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [graph, setGraph] = useState<ObjectGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);

  const mode = parseMode(search);
  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/memory/graph", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGraph(await res.json());
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load discovery");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const objects = useMemo<AnyMemoryObject[]>(() => graph?.objects || [], [graph]);

  const list = useMemo<AnyMemoryObject[]>(() => {
    if (mode === "conflicts") return objects.filter((o) => o.type === "memory_conflict");
    if (mode === "open-questions") return objects.filter((o) => o.type === "open_question");
    if (mode === "low-confidence")
      return objects
        .filter((o) => (o.confidence ?? 1) < LOW_CONFIDENCE)
        .sort((a, b) => (a.confidence ?? 1) - (b.confidence ?? 1));
    return [];
  }, [objects, mode]);

  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    if (mode !== "duplicates") return [];
    const buckets = new Map<string, DuplicateGroup>();
    for (const o of objects) {
      const name = (o.canonicalName || "").trim();
      if (!name) continue;
      const key = `${o.type}::${name.toLowerCase()}`;
      if (!buckets.has(key)) {
        buckets.set(key, { key, canonicalName: name, type: o.type, members: [] });
      }
      buckets.get(key)!.members.push(o);
    }
    return Array.from(buckets.values())
      .filter((g) => g.members.length > 1)
      .map((g) => ({
        ...g,
        members: [...g.members].sort((a, b) =>
          (a.confidence ?? 0) === (b.confidence ?? 0)
            ? a.updatedAt < b.updatedAt
              ? 1
              : -1
            : (b.confidence ?? 0) - (a.confidence ?? 0),
        ),
      }));
  }, [objects, mode]);

  const merge = useCallback(
    async (group: DuplicateGroup) => {
      setMerging(group.key);
      setError(null);
      setNotice(null);
      try {
        const [keeper, ...drops] = group.members;
        const res = await fetch("/api/me/memory/merge-objects", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keepId: keeper.id,
            dropIds: drops.map((d) => d.id),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        setNotice(
          `Merged ${body.merged} duplicate${body.merged === 1 ? "" : "s"} into ${
            body.keeper?.canonicalName || keeper.canonicalName
          }.`,
        );
        await refresh();
      } catch (err: any) {
        setError(err?.message || "Merge failed.");
      } finally {
        setMerging(null);
      }
    },
    [refresh],
  );

  const accentMap = {
    amber: "border-amber-400/25 bg-amber-400/[0.05] text-amber-200",
    cyan: "border-cyan-400/25 bg-cyan-400/[0.05] text-cyan-200",
    fuchsia: "border-fuchsia-400/25 bg-fuchsia-400/[0.05] text-fuchsia-200",
    emerald: "border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-200",
  } as const;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe-sm zed-glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/home")}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Home
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-300" />
          <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            Discovery
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
          aria-label="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
        <section
          className={`rounded-3xl border p-5 ${accentMap[activeMode.accent]} bg-gradient-to-br from-white/[0.02] to-black`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em]">
            <activeMode.icon size={14} />
            {activeMode.label}
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white">{activeMode.label}</h1>
          <p className="mt-2 text-sm leading-6 text-white/70">{activeMode.hint}</p>
        </section>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {MODES.map((m) => {
            const MIcon = m.icon;
            const count =
              m.id === "duplicates"
                ? (() => {
                    const buckets = new Map<string, number>();
                    for (const o of objects) {
                      const n = (o.canonicalName || "").trim().toLowerCase();
                      if (!n) continue;
                      const key = `${o.type}::${n}`;
                      buckets.set(key, (buckets.get(key) || 0) + 1);
                    }
                    return Array.from(buckets.values()).filter((v) => v > 1).length;
                  })()
                : m.id === "conflicts"
                  ? objects.filter((o) => o.type === "memory_conflict").length
                  : m.id === "open-questions"
                    ? objects.filter((o) => o.type === "open_question").length
                    : objects.filter((o) => (o.confidence ?? 1) < LOW_CONFIDENCE).length;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/discovery?filter=${m.id}`)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                  mode === m.id
                    ? "border-cyan-400/40 bg-cyan-400/[0.08] text-cyan-100"
                    : "border-white/10 bg-white/[0.02] text-white/60 hover:text-white/85 hover:border-white/20"
                }`}
              >
                <MIcon size={11} />
                {m.label}
                <span className="ml-0.5 text-[10.5px] text-white/45 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        {notice && (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] px-3 py-2 text-sm text-emerald-200">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : mode === "duplicates" ? (
          duplicateGroups.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
              No duplicates. Everything Zed knows is unique.
            </div>
          ) : (
            <div className="space-y-3">
              {duplicateGroups.map((g) => (
                <section
                  key={g.key}
                  className="rounded-2xl border border-emerald-400/20 bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-white truncate">
                        {g.canonicalName}
                      </div>
                      <div className="text-[11px] text-white/45">
                        {g.type.replace(/_/g, " ")} · {g.members.length} copies
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void merge(g)}
                      disabled={merging === g.key}
                      className="rounded-lg bg-emerald-400 text-black font-medium hover:bg-emerald-300 h-8"
                    >
                      {merging === g.key ? "Merging…" : `Merge ${g.members.length} → 1`}
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {g.members.map((m, i) => (
                      <div
                        key={m.id}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="border-white/10 bg-white/[0.06] text-[9px] uppercase tracking-[0.14em]"
                          >
                            {i === 0 ? "Keeper" : `Drop ${i}`}
                          </Badge>
                          <span className="text-[10.5px] text-white/40">
                            conf {(m.confidence ?? 0).toFixed(2)}
                          </span>
                        </div>
                        {m.summary && (
                          <div className="mt-1 text-[12px] leading-snug text-white/70">
                            {m.summary.slice(0, 220)}
                            {m.summary.length > 220 ? "…" : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
            Nothing here. That's the clean state.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-white truncate">
                      {o.canonicalName}
                    </div>
                    <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/40">
                      {o.type.replace(/_/g, " ")}
                      {mode === "low-confidence" &&
                        ` · confidence ${(o.confidence ?? 0).toFixed(2)}`}
                    </div>
                  </div>
                </div>
                {o.summary && (
                  <p className="mt-2 text-[12.5px] leading-snug text-white/70">
                    {o.summary.slice(0, 320)}
                    {o.summary.length > 320 ? "…" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
