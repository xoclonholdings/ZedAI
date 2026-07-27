import { useCallback, useEffect, useMemo, useState } from "react";
import { GraduationCap, Plus, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BaseObject, ObjectGraph } from "@shared/object-memory-types";

interface UploadResponse {
  uploaded: Array<{
    sourceLabel: string;
    extractedObjects: number;
    extractedRelationships: number;
    objectTitles: string[];
  }>;
  totals: {
    newObjects: number;
    newRelationships: number;
    graphObjects: number;
    graphRelationships: number;
  };
  appliedAt: string;
}

const EMPTY_FORM = { title: "", content: "" };

function friendlyType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LearningPage() {
  const [graph, setGraph] = useState<ObjectGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError(err?.message || "Failed to load knowledge library");
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
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("files", file);
        if (form.title.trim()) fd.append("title", form.title.trim());
        if (hasText) fd.append("content", form.content.trim());
        res = await fetch("/api/me/memory/upload", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
      } else {
        res = await fetch("/api/me/memory/upload", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title.trim() || undefined,
            content: form.content.trim(),
          }),
        });
      }
      const body: UploadResponse & { error?: string } = await res.json().catch(() => ({}) as any);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setNotice(
        `Learned ${body.totals?.newObjects ?? 0} object${body.totals?.newObjects === 1 ? "" : "s"} — Zed can pull them into any conversation.`,
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

  const groups = useMemo(() => {
    const out: Record<string, BaseObject[]> = {};
    for (const o of graph?.objects || []) {
      if (!out[o.type]) out[o.type] = [];
      out[o.type].push(o);
    }
    return out;
  }, [graph]);

  const orderedTypes = useMemo(() => Object.keys(groups).sort(), [groups]);
  const objectCount = graph?.objects?.length ?? 0;
  const relCount = graph?.relationships?.length ?? 0;
  const scopeLabel = (graph as any)?.scope === "admin" ? "Admin memory" : "User memory";

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            <GraduationCap size={14} />
            Learning
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Your knowledge library</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Whatever you upload here gets structured into objects Zed can reference in any conversation.
            Paste notes, or attach PDFs, transcripts, or documents.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
            <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
              {objectCount} object{objectCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
              {relCount} link{relCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
              {scopeLabel}
            </Badge>
          </div>
        </section>

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

        <Button
          onClick={() => setShowForm((v) => !v)}
          className="w-full rounded-xl zed-gradient"
        >
          <Plus size={14} className="mr-2" />
          {showForm ? "Cancel" : "Add to memory"}
        </Button>

        {showForm && (
          <section className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Teach Zed something new</div>
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
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Notes to remember</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={7}
                placeholder="Paste anything — a fact about you, your business, a decision, a preference, an event…"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Or attach a file</label>
              <div className="mt-1 flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 hover:border-white/25">
                  <Upload size={14} />
                  {file ? file.name : "Choose file"}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
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
            <Button
              onClick={() => void submit()}
              disabled={submitting}
              className="w-full rounded-xl zed-gradient"
            >
              {submitting ? "Learning…" : "Save to memory"}
            </Button>
          </section>
        )}

        <section className="space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            What Zed knows about you
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : orderedTypes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
              Nothing here yet. Add notes above and Zed will start remembering.
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
                  {groups[type].slice(0, 12).map((obj) => (
                    <li key={obj.id} className="text-[12.5px] leading-snug">
                      <div className="text-white/90">{obj.canonicalName}</div>
                      {obj.summary && (
                        <div className="text-[11.5px] text-white/55 max-w-[80ch]">
                          {obj.summary.slice(0, 180)}
                          {obj.summary.length > 180 ? "…" : ""}
                        </div>
                      )}
                    </li>
                  ))}
                  {groups[type].length > 12 && (
                    <li className="text-[11px] text-white/40">
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
