import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Plus, Upload, X } from "lucide-react";

import { cleanSummary, cleanTitle } from "@/lib/text";
import type { BaseObject, ObjectGraph } from "@shared/object-memory-types";

/**
 * A workspace's own knowledge library. Everything added here is tagged
 * with the workspace, so each workspace shows its own slice — but it all
 * merges into the current user's object-memory graph
 * (/api/me/memory/upload). For the admin user, this is Admin memory;
 * it is not System memory.
 *
 * Reused across every workspace surface so "add knowledge" is consistent.
 */

function friendlyType(t: string): string {
  return (t || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function WorkspaceLibrary({
  workspace,
  label = "Knowledge library",
}: {
  workspace: string;
  label?: string;
}) {
  const [items, setItems] = useState<BaseObject[]>([]);
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me/memory/graph", { credentials: "include" });
      if (!res.ok) return;
      const graph = (await res.json()) as ObjectGraph;
      const mine = (graph.objects || []).filter(
        (o) => (o.properties as any)?.workspace === workspace,
      );
      setItems(mine);
    } catch {
      /* silent — library is additive */
    }
  }, [workspace]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (files.length === 0 && !content.trim()) {
      setError("Paste some notes or attach a file to teach ZAR.");
      return;
    }
    setSubmitting(true);
    try {
      let res: Response;
      if (files.length > 0) {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        fd.append("workspace", workspace);
        if (content.trim()) {
          fd.append("content", content.trim());
          fd.append("title", title.trim() || `${friendlyType(workspace)} note`);
        }
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
            workspace,
            title: title.trim() || `${friendlyType(workspace)} note`,
            content: content.trim(),
          }),
        });
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const added = body?.totals?.newObjects ?? 0;
      setNotice(
        added > 0
          ? `ZAR learned ${added} thing${added === 1 ? "" : "s"} into ${friendlyType(workspace)} memory.`
          : "Saved into this memory scope.",
      );
      setTitle("");
      setContent("");
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      setShowForm(false);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not add knowledge.");
    } finally {
      setSubmitting(false);
    }
  }, [files, content, title, workspace, refresh]);

  return (
    <section className="zar-glass rounded-2xl p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-cyan-300" />
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="text-[11px] text-white/40">
            {items.length} in this workspace
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-white/50" />
        ) : (
          <ChevronDown size={16} className="text-white/50" />
        )}
      </button>
      <p className="mt-1 text-[11.5px] text-white/40 leading-snug">
        Teach ZAR about {friendlyType(workspace)}. It's kept in this user's memory scope and shown
        here when tagged to the workspace.
      </p>

      {open && (
        <div className="mt-3 space-y-3">
          {notice && (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-[12px] text-emerald-200">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-[12px] text-red-200">
              {error}
            </div>
          )}

          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[13px] hover:bg-cyan-300 hover:shadow-[0_0_16px_rgba(103,232,249,0.5)] transition-all"
            >
              <Plus size={13} />
              Add knowledge
            </button>
          ) : (
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-3 space-y-2 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="text-[12.5px] font-semibold text-white">Add knowledge</div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-white/50 hover:text-white/80"
                  aria-label="Cancel"
                >
                  <X size={15} />
                </button>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)"
                className="zar-input w-full rounded-lg px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder={`Paste notes, a summary, or a transcript about ${friendlyType(workspace).toLowerCase()}.`}
                className="zar-input w-full rounded-lg px-2.5 py-2 text-[13px] text-white outline-none placeholder:text-white/30 resize-y"
              />
              <input
                ref={fileRef}
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-[12px] text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-1.5 file:text-black file:font-medium hover:file:bg-cyan-300"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[13px] hover:bg-cyan-300 hover:shadow-[0_0_16px_rgba(103,232,249,0.5)] disabled:opacity-50 transition-all"
                >
                  <Upload size={13} />
                  {submitting ? "Teaching ZAR…" : "Add to library"}
                </button>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-1.5">
              {items.slice(0, 30).map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-white">{cleanTitle(o.canonicalName)}</span>
                    <span className="text-[9.5px] uppercase tracking-[0.06em] rounded-full px-1.5 py-0.5 bg-white/[0.06] text-white/50">
                      {friendlyType(o.type)}
                    </span>
                  </div>
                  {o.summary && (
                    <div className="mt-0.5 text-[12px] text-white/55 leading-snug">
                      {cleanSummary(o.summary, 200)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
