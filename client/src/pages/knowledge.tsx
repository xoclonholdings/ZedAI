import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Link as LinkIcon, Network, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AnyMemoryObject, BaseObject, ObjectGraph } from "@shared/object-memory-types";

function friendlyType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function friendlyRel(t: string): string {
  return t.replace(/_/g, " ").toLowerCase();
}

/**
 * The real Knowledge surface, reachable from Nexus's "Knowledge" domain.
 *
 * Reads the same object-memory graph Memory's page writes to
 * (/api/me/memory/graph) - the only real "knowledge records + relationship
 * graph" backend in the app - but as a read-only source library: objects
 * with their evidence/source references, and the relationship graph between
 * them. Adding/teaching new memory stays exclusively on Memory's page;
 * Knowledge is for browsing what's already there and where it came from.
 */
export default function KnowledgePage() {
  const [, navigate] = useLocation();
  const [graph, setGraph] = useState<ObjectGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/memory/graph", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGraph(await res.json());
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load the knowledge graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byId = useMemo(() => {
    const map = new Map<string, AnyMemoryObject>();
    for (const object of graph?.objects || []) map.set(object.id, object);
    return map;
  }, [graph]);

  const groups = useMemo(() => {
    const out: Record<string, BaseObject[]> = {};
    for (const object of graph?.objects || []) {
      if (!out[object.type]) out[object.type] = [];
      out[object.type].push(object);
    }
    return out;
  }, [graph]);

  const orderedTypes = useMemo(() => Object.keys(groups).sort(), [groups]);
  const objectCount = graph?.objects?.length ?? 0;
  const relCount = graph?.relationships?.length ?? 0;
  const sources = graph?.sources ?? [];

  const relationshipsFor = useCallback(
    (objectId: string) => (graph?.relationships || []).filter(
      (rel) => rel.fromObjectId === objectId || rel.toObjectId === objectId,
    ),
    [graph],
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe-sm zed-glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/nexus")}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Nexus
        </Button>
        <div className="flex items-center gap-2">
          <Network size={16} className="text-blue-300" />
          <span className="font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">
            Knowledge
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
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-black p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-blue-200/80">
            <Network size={14} />
            Source-backed knowledge
          </div>
          <h1 className="mt-2 text-2xl font-semibold">What Zed can cite</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Every record here traces back to something you gave Zed - a note, a file,
            a conversation. Browse the records, their sources, and how they connect.
            To teach Zed something new, use Memory instead.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
            <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
              {objectCount} record{objectCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
              {relCount} relationship{relCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
              {sources.length} source{sources.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {sources.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Sources</div>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((source) => (
                <span
                  key={source}
                  className="max-w-[220px] truncate rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/70"
                  title={source}
                >
                  {source}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Records{loading ? " (loading)" : ""}
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : orderedTypes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
              Nothing here yet. Teach Zed something through Memory and it'll show up here, sourced.
            </div>
          ) : (
            orderedTypes.map((type) => (
              <div key={type} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-white/90">{friendlyType(type)}</span>
                  <Badge
                    variant="secondary"
                    className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.14em]"
                  >
                    {groups[type].length}
                  </Badge>
                </div>
                <ul className="space-y-1.5">
                  {groups[type].slice(0, 12).map((object) => {
                    const relationships = relationshipsFor(object.id);
                    const expanded = expandedId === object.id;
                    return (
                      <li key={object.id} className="rounded-xl border border-transparent hover:border-white/10">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : object.id)}
                          className="block w-full px-2 py-1.5 text-left"
                        >
                          <div className="text-[12.5px] text-white/90">{object.canonicalName}</div>
                          {object.summary && (
                            <div className="max-w-[80ch] text-[11.5px] text-white/55">
                              {object.summary.slice(0, 180)}
                              {object.summary.length > 180 ? "…" : ""}
                            </div>
                          )}
                        </button>
                        {expanded && (
                          <div className="space-y-2 border-t border-white/[0.06] px-2 py-2">
                            {object.sourceRefs.length > 0 && (
                              <div>
                                <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">
                                  Sourced from
                                </div>
                                <ul className="space-y-1">
                                  {object.sourceRefs.map((ref, index) => (
                                    <li key={index} className="text-[11.5px] text-white/60">
                                      <span className="text-white/75">{ref.sourceFile}</span>
                                      {ref.evidenceQuote && (
                                        <span className="text-white/45">
                                          {" "}
                                          — "{ref.evidenceQuote.slice(0, 140)}
                                          {ref.evidenceQuote.length > 140 ? "…" : ""}"
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {relationships.length > 0 && (
                              <div>
                                <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">
                                  Connected
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {relationships.map((rel) => {
                                    const outgoing = rel.fromObjectId === object.id;
                                    const other = byId.get(outgoing ? rel.toObjectId : rel.fromObjectId);
                                    if (!other) return null;
                                    return (
                                      <span
                                        key={rel.id}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/80"
                                        title={rel.evidence || undefined}
                                      >
                                        <LinkIcon size={10} className="text-blue-300/70" />
                                        <span className="max-w-[16ch] truncate">{other.canonicalName}</span>
                                        <span className="text-white/40">· {friendlyRel(rel.relationshipType)}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {groups[type].length > 12 && (
                    <li className="px-2 text-[11px] text-white/40">
                      +{groups[type].length - 12} more
                    </li>
                  )}
                </ul>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
