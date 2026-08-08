import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Compass, History, Link as LinkIcon, Network, Plus, Scale, Upload, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cleanSummary, cleanTitle, friendlySource } from "@/lib/text";
import { uploadRequest } from "@/lib/uploadRequest";
import type { AnyMemoryObject, BaseObject, ObjectGraph } from "@shared/object-memory-types";

interface UploadResponse {
  totals: {
    newObjects: number;
    newRelationships: number;
    graphObjects: number;
    graphRelationships: number;
  };
}

const EMPTY_FORM = { title: "", content: "" };

function friendlyType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function friendlyRel(t: string): string {
  return t.replace(/_/g, " ").toLowerCase();
}

/**
 * The real Knowledge surface, reachable from Nexys's "Knowledge" domain.
 *
 * Reads and writes the one real "knowledge records + relationship graph"
 * backend in the app (/api/me/memory/graph, /api/me/memory/upload): teach
 * ZAR something and browse everything it already knows — with sources and
 * relationships — in the same place. This used to be split across a
 * separate "Memory" page (write-only) and this page (read-only); that split
 * duplicated the same object list on two screens for no real reason, so
 * it's merged here. Memory as a root hub is reserved for actual retention
 * policy/privacy controls later, not a second copy of this browser.
 */
export default function KnowledgePage() {
  const [, navigate] = useLocation();
  const [graph, setGraph] = useState<ObjectGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const submit = useCallback(async () => {
    setError(null);
    setNotice(null);
    const hasText = form.content.trim().length > 0;
    if (!hasText && !file) {
      setError("Paste some text or attach a file.");
      return;
    }
    setSubmitting(true);
    try {
      let body: UploadResponse & { error?: string };
      if (file) {
        const fd = new FormData();
        fd.append("files", file);
        if (form.title.trim()) fd.append("title", form.title.trim());
        if (hasText) fd.append("content", form.content.trim());
        body = await uploadRequest<UploadResponse & { error?: string }>(
          "/api/me/memory/upload",
          fd,
        );
      } else {
        const res = await fetch("/api/me/memory/upload", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title.trim() || undefined,
            content: form.content.trim(),
          }),
        });
        body = await res.json().catch(() => ({}) as any);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setNotice(
        `Learned ${body.totals?.newObjects ?? 0} object${body.totals?.newObjects === 1 ? "" : "s"} — ZAR can pull them into any conversation.`,
      );
      setForm(EMPTY_FORM);
      setFile(null);
      setShowForm(false);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }, [form, file, refresh]);

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
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-black p-5 backdrop-blur-md shadow-[0_0_40px_rgba(139,0,255,0.15)]">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Network size={18} className="text-blue-300" />
            What ZAR knows
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Everything you've taught ZAR, with sources and how it connects.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
            <Badge variant="secondary" className="zar-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
              {objectCount} record{objectCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="secondary" className="zar-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
              {relCount} relationship{relCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="secondary" className="zar-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
              {sources.length} source{sources.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </section>

        <Button onClick={() => setShowForm((v) => !v)} className="w-full rounded-xl zar-gradient">
          <Plus size={14} className="mr-2" />
          {showForm ? "Cancel" : "Teach ZAR something new"}
        </Button>

        {showForm && (
          <section className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.03] p-4 space-y-3 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Teach ZAR something new</div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-white/50 hover:text-white/80"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Title (optional)</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. About my company"
                className="zar-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Notes to remember</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={7}
                placeholder="Paste anything — a fact about you, your business, a decision, a preference, an event…"
                className="zar-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Or attach a file</label>
              <div className="mt-1 flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 hover:border-white/25">
                  <Upload size={14} />
                  {file ? file.name : "Choose file"}
                  <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                {file && (
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-xs text-white/50 hover:text-white/80"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <Button onClick={() => void submit()} disabled={submitting} className="w-full rounded-xl zar-gradient">
              {submitting ? "Learning…" : "Save to knowledge"}
            </Button>
          </section>
        )}

        {notice && (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] px-3 py-2 text-sm text-emerald-200">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => navigate("/discovery")}
            className="zar-glass flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-all hover:shadow-[0_0_18px_rgba(96,165,250,0.3)]"
          >
            <Compass size={16} className="text-blue-300" />
            <span className="text-[11.5px] font-medium text-white/80">Discovery</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/decisions")}
            className="zar-glass flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-all hover:shadow-[0_0_18px_rgba(96,165,250,0.3)]"
          >
            <Scale size={16} className="text-blue-300" />
            <span className="text-[11.5px] font-medium text-white/80">Decisions</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/timeline")}
            className="zar-glass flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-all hover:shadow-[0_0_18px_rgba(96,165,250,0.3)]"
          >
            <History size={16} className="text-blue-300" />
            <span className="text-[11.5px] font-medium text-white/80">Timeline</span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {sources.length > 0 && (
          <section className="zar-glass rounded-2xl p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Sources</div>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((source) => (
                <span
                  key={source}
                  className="max-w-[220px] truncate rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/70"
                  title={source}
                >
                  {friendlySource(source)}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Records{loading ? " (loading)" : ""}
            </div>
            <p className="mt-0.5 text-[11.5px] text-white/45">
              Grouped by what kind of thing each note became — a decision, a rule, an open question, and so on.
            </p>
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : orderedTypes.length === 0 ? (
            <div className="zar-glass rounded-2xl p-4 text-sm text-muted-foreground">
              Nothing here yet. Use "Teach ZAR something new" above and it'll show up here, sourced.
            </div>
          ) : (
            orderedTypes.map((type) => (
              <div key={type} className="zar-glass rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-white/90">{friendlyType(type)}</span>
                  <Badge
                    variant="secondary"
                    className="zar-glass border-white/10 text-[9px] uppercase tracking-[0.14em]"
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
                          <div className="text-[12.5px] text-white/90">{cleanTitle(object.canonicalName)}</div>
                          {object.summary && (
                            <div className="max-w-[80ch] text-[11.5px] text-white/55">
                              {cleanSummary(object.summary, 180)}
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
                                      <span className="text-white/75" title={ref.sourceFile}>
                                        {friendlySource(ref.sourceFile)}
                                      </span>
                                      {ref.evidenceQuote && (
                                        <span className="text-white/45"> — "{cleanSummary(ref.evidenceQuote, 140)}"</span>
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
                                        <span className="max-w-[16ch] truncate">{cleanTitle(other.canonicalName, 40)}</span>
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
  );
}
