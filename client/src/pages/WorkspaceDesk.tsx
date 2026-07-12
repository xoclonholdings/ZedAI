import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import WorkspaceLibrary from "@/components/WorkspaceLibrary";
import type { WorkspaceDeskEntry, WorkspaceDeskSpec } from "@shared/workspace-desk-types";

/**
 * The working surface for Education / Operations / Marketing. You hand
 * Zed a subject, Zed grounds in the workspace's memory, and returns a
 * structured entry that stacks up durably here. Same shape everywhere,
 * domain-specific sections per workspace.
 */

function EntryCard({
  entry,
  onDelete,
}: {
  entry: WorkspaceDeskEntry;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-white">{entry.topic}</span>
            {entry.draft && (
              <span className="text-[9.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 bg-amber-400/15 text-amber-200">
                Draft
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-white/55 leading-snug">{entry.summary}</div>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-white/50 hover:text-white/90 transition-colors"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-white/40 hover:text-red-300 transition-colors"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 border-t border-white/[0.06] pt-3">
          {entry.sections.map((s, i) => (
            <div key={i}>
              <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1">
                {s.label}
              </div>
              <ul className="space-y-1">
                {s.items.map((it, j) => (
                  <li key={j} className="text-[13px] text-white/75 leading-snug">
                    · {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="text-[11px] text-white/35 italic leading-snug">{entry.basis}</div>
        </div>
      )}
    </div>
  );
}

export default function WorkspaceDesk({ workspace }: { workspace: string }) {
  const [, navigate] = useLocation();
  const [spec, setSpec] = useState<WorkspaceDeskSpec | null>(null);
  const [entries, setEntries] = useState<WorkspaceDeskEntry[]>([]);
  const [topic, setTopic] = useState("");
  const [sources, setSources] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace}/desk`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSpec(data.spec || null);
        setEntries(data.entries || []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load this desk");
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async () => {
    setError(null);
    if (!topic.trim()) {
      setError("Type a subject for Zed to work on.");
      return;
    }
    setWorking(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace}/desk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), sources: sources.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      if (body.entry) setEntries((prev) => [body.entry as WorkspaceDeskEntry, ...prev]);
      setTopic("");
      setSources("");
      setShowSources(false);
    } catch (err: any) {
      setError(err?.message || "Zed could not build this. Try again.");
    } finally {
      setWorking(false);
    }
  }, [workspace, topic, sources]);

  const remove = useCallback(
    async (id: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      try {
        await fetch(`/api/workspaces/${workspace}/desk/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch {
        /* optimistic */
      }
    },
    [workspace],
  );

  const title = spec?.title || `${workspace} desk`;

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
            {title}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refresh()}
          className="rounded-xl text-xs text-muted-foreground hover:text-foreground zed-button"
        >
          <RefreshCw size={14} className={loading ? "mr-1 animate-spin" : "mr-1"} />
          Refresh
        </Button>
      </div>

      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">{title}</div>
          <p className="mt-1 text-[13px] text-white/60 leading-snug">{spec?.blurb || ""}</p>
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) void run();
              }}
              placeholder={spec?.placeholder || "What should Zed work on?"}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/50"
            />
            {showSources ? (
              <textarea
                value={sources}
                onChange={(e) => setSources(e.target.value)}
                rows={4}
                placeholder="Optional: paste notes or a document for Zed to ground this in."
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/50 resize-y"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowSources(true)}
                className="text-[12px] text-cyan-300/80 hover:text-cyan-200"
              >
                + Add sources (optional)
              </button>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => navigate(`/chat?ctx=${workspace}`)}
                className="inline-flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white/80"
              >
                <MessageSquare size={13} />
                Ask Zed directly
              </button>
              <Button onClick={() => void run()} disabled={working} className="rounded-xl zed-gradient">
                <Sparkles size={14} className="mr-1.5" />
                {working ? "Working…" : spec?.action || "Build"}
              </Button>
            </div>
          </div>
        </section>

        <WorkspaceLibrary workspace={workspace} label={`${title} library`} />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {working && (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4 text-sm text-cyan-100">
            Zed is grounding in this workspace's memory and building your entry…
          </div>
        )}

        <section className="space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            On this desk {entries.length > 0 ? `(${entries.length})` : ""}
          </div>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-muted-foreground">
              Nothing here yet. Give Zed a subject above and your work will collect here.
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((e) => (
                <EntryCard key={e.id} entry={e} onDelete={remove} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
