import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  Gavel,
  Link as LinkIcon,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AnyMemoryObject,
  DecisionObject,
  ObjectGraph,
  ObjectRelationship,
} from "@shared/object-memory-types";

/**
 * Decisions — first-class view.
 *
 * Reads the applied object graph, filters for `decision` objects,
 * and shows related projects, tasks, superseded predecessors, and
 * source evidence. No new backend endpoints — the graph is the
 * single source of truth.
 */

function friendlyTime(t?: string): string {
  if (!t) return "";
  try {
    const d = new Date(t);
    const now = new Date();
    const min = Math.round((now.getTime() - d.getTime()) / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return d.toLocaleDateString();
  } catch {
    return t;
  }
}

function friendlyRel(t: string): string {
  return t.replace(/_/g, " ").toLowerCase();
}

function useMemoryGraph() {
  const [graph, setGraph] = useState<ObjectGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/memory/graph", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGraph(await res.json());
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load decisions");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { graph, loading, error, refresh };
}

export function DecisionsListPage() {
  const [, navigate] = useLocation();
  const { graph, loading, error, refresh } = useMemoryGraph();

  const decisions = useMemo<DecisionObject[]>(() => {
    const list = (graph?.objects || []).filter(
      (o): o is DecisionObject => o.type === "decision",
    );
    list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return list;
  }, [graph]);

  const byMonth = useMemo(() => {
    const groups: Record<string, DecisionObject[]> = {};
    for (const d of decisions) {
      const label = (() => {
        try {
          return new Date(d.updatedAt).toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          });
        } catch {
          return "Undated";
        }
      })();
      if (!groups[label]) groups[label] = [];
      groups[label].push(d);
    }
    return groups;
  }, [decisions]);
  const monthOrder = Object.keys(byMonth);

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
          <Gavel size={16} className="text-cyan-300" />
          <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            Decisions
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
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            <Gavel size={14} />
            Decisions
          </div>
          <h1 className="mt-2 text-2xl font-semibold">What you've decided</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Every decision Zed has captured — what it was, when it happened, and what it
            connects to. Tap one to see the full context.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : decisions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
            No decisions yet. As you use Zed, decisions get extracted from your notes and
            chats and show up here.
          </div>
        ) : (
          monthOrder.map((month) => (
            <section key={month} className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {month}
              </div>
              <div className="space-y-2">
                {byMonth[month].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => navigate(`/decisions/${d.id}`)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition-all hover:border-cyan-400/40 hover:bg-white/5 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-white">
                          {d.canonicalName}
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-snug text-white/60">
                          {(d.properties?.decision || d.summary || "")
                            .toString()
                            .slice(0, 220)}
                          {(d.properties?.decision || d.summary || "").length > 220 ? "…" : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] text-white/40">
                          <span>{friendlyTime(d.updatedAt)}</span>
                          {d.properties?.date && (
                            <>
                              <span>·</span>
                              <span>decided {d.properties.date}</span>
                            </>
                          )}
                          {d.status && d.status !== "active" && (
                            <Badge
                              variant="secondary"
                              className="ml-1 border-white/10 bg-white/[0.06] text-[9px] uppercase tracking-[0.14em]"
                            >
                              {d.status.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-white/40 shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

export function DecisionDetailPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { graph, loading, error } = useMemoryGraph();

  const decision = useMemo<DecisionObject | null>(() => {
    const found = (graph?.objects || []).find((o) => o.id === id);
    return found && found.type === "decision" ? (found as DecisionObject) : null;
  }, [graph, id]);

  const byId = useMemo(() => {
    const m = new Map<string, AnyMemoryObject>();
    for (const o of graph?.objects || []) m.set(o.id, o);
    return m;
  }, [graph]);

  const related = useMemo(() => {
    if (!decision || !graph) return [] as Array<{
      rel: ObjectRelationship;
      other: AnyMemoryObject;
      outgoing: boolean;
    }>;
    const out: Array<{ rel: ObjectRelationship; other: AnyMemoryObject; outgoing: boolean }> = [];
    for (const rel of graph.relationships) {
      if (rel.fromObjectId === decision.id) {
        const other = byId.get(rel.toObjectId);
        if (other) out.push({ rel, other, outgoing: true });
      } else if (rel.toObjectId === decision.id) {
        const other = byId.get(rel.fromObjectId);
        if (other) out.push({ rel, other, outgoing: false });
      }
    }
    return out;
  }, [decision, graph, byId]);

  const relatedProjects = related.filter((r) => r.other.type === "project");
  const resultingTasks = related.filter((r) => r.other.type === "task");
  const supersedes = related.filter(
    (r) => r.rel.relationshipType === "SUPERSEDES" && r.outgoing,
  );
  const supersededBy = related.filter(
    (r) => r.rel.relationshipType === "SUPERSEDES" && !r.outgoing,
  );
  const contradicts = related.filter((r) => r.rel.relationshipType === "CONTRADICTS");
  const otherLinks = related.filter(
    (r) =>
      !["project", "task"].includes(r.other.type) &&
      !["SUPERSEDES", "CONTRADICTS"].includes(r.rel.relationshipType),
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe-sm zed-glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/decisions")}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Decisions
        </Button>
        <div className="flex items-center gap-2">
          <Gavel size={16} className="text-cyan-300" />
          <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            Decision
          </span>
        </div>
        <span className="w-14" />
      </div>

      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !decision ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
            This decision isn't in memory. It may have been archived or superseded.
          </div>
        ) : (
          <>
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
                <Gavel size={14} />
                Decision
                {decision.status && decision.status !== "active" && (
                  <Badge
                    variant="secondary"
                    className="ml-1 border-white/10 bg-white/[0.06] text-[9px] uppercase tracking-[0.14em]"
                  >
                    {decision.status.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-semibold">{decision.canonicalName}</h1>
              <p className="mt-2 text-sm leading-6 text-white/80">
                {decision.properties?.decision || decision.summary}
              </p>
              <div className="mt-3 text-[11px] text-white/50">
                {decision.properties?.date
                  ? `Decided ${decision.properties.date} · `
                  : ""}
                Updated {friendlyTime(decision.updatedAt)}
              </div>
            </section>

            {decision.properties?.rationale && (
              <DetailBlock label="Why">
                <p className="text-sm leading-6 text-white/80">{decision.properties.rationale}</p>
              </DetailBlock>
            )}

            {decision.properties?.affectedSystems && decision.properties.affectedSystems.length > 0 && (
              <DetailBlock label="Affected systems">
                <div className="flex flex-wrap gap-1.5">
                  {decision.properties.affectedSystems.map((s) => (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="border-white/10 bg-white/[0.06] text-[10.5px]"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </DetailBlock>
            )}

            {supersedes.length > 0 && (
              <DetailBlock label="Supersedes">
                {supersedes.map((r) => (
                  <RelationRow key={r.rel.id} label={r.other.canonicalName} />
                ))}
              </DetailBlock>
            )}
            {supersededBy.length > 0 && (
              <DetailBlock label="Superseded by">
                {supersededBy.map((r) => (
                  <RelationRow key={r.rel.id} label={r.other.canonicalName} />
                ))}
              </DetailBlock>
            )}
            {contradicts.length > 0 && (
              <DetailBlock label="Contradicts">
                {contradicts.map((r) => (
                  <RelationRow
                    key={r.rel.id}
                    label={r.other.canonicalName}
                    hint={r.rel.evidence}
                  />
                ))}
              </DetailBlock>
            )}

            {relatedProjects.length > 0 && (
              <DetailBlock label="Related projects">
                {relatedProjects.map((r) => (
                  <RelationRow
                    key={r.rel.id}
                    label={r.other.canonicalName}
                    hint={friendlyRel(r.rel.relationshipType)}
                  />
                ))}
              </DetailBlock>
            )}

            {resultingTasks.length > 0 && (
              <DetailBlock label="Resulting tasks">
                {resultingTasks.map((r) => (
                  <RelationRow
                    key={r.rel.id}
                    label={r.other.canonicalName}
                    hint={friendlyRel(r.rel.relationshipType)}
                  />
                ))}
              </DetailBlock>
            )}

            {otherLinks.length > 0 && (
              <DetailBlock label="Other links">
                {otherLinks.map((r) => (
                  <RelationRow
                    key={r.rel.id}
                    label={r.other.canonicalName}
                    hint={`${friendlyRel(r.rel.relationshipType)} · ${r.other.type.replace(/_/g, " ")}`}
                  />
                ))}
              </DetailBlock>
            )}

            {decision.sourceRefs && decision.sourceRefs.length > 0 && (
              <DetailBlock label="Sources">
                <div className="space-y-1.5">
                  {decision.sourceRefs.slice(0, 6).map((ref, i) => (
                    <div
                      key={`${ref.sourceFile}-${i}`}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
                    >
                      <div className="text-[11px] uppercase tracking-[0.1em] text-white/40">
                        {ref.conversationTitle || ref.sourceFile}
                      </div>
                      <div className="mt-1 text-[12.5px] leading-snug text-white/75">
                        {ref.evidenceQuote}
                      </div>
                    </div>
                  ))}
                  {decision.sourceRefs.length > 6 && (
                    <div className="text-[11px] text-white/40">
                      +{decision.sourceRefs.length - 6} more source{decision.sourceRefs.length - 6 === 1 ? "" : "s"}
                    </div>
                  )}
                </div>
              </DetailBlock>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-2">{label}</div>
      {children}
    </section>
  );
}

function RelationRow({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <LinkIcon size={12} className="text-cyan-300/70 shrink-0 mt-1" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-white/90 truncate">{label}</div>
        {hint && (
          <div className="text-[11px] text-white/50 truncate">
            {hint}
            <ArrowUpRight size={9} className="inline ml-1" />
          </div>
        )}
      </div>
    </div>
  );
}
