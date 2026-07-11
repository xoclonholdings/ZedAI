import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ResearchBrief } from "@shared/research-types";

/**
 * The Research workspace — an actual working surface, not a menu. You
 * hand Zed a subject (and optionally paste sources), Zed returns a
 * structured brief, and every brief stacks up here durably so the desk
 * becomes your research record. Everything is editable/removable and
 * nothing is auto-shared.
 */

function List({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1">{label}</div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[13px] text-white/75 leading-snug">
            · {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BriefCard({
  brief,
  onDelete,
}: {
  brief: ResearchBrief;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-white">{brief.topic}</span>
            {brief.draft && (
              <span className="text-[9.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 bg-amber-400/15 text-amber-200">
                Draft
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-white/55 leading-snug">{brief.summary}</div>
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
            onClick={() => onDelete(brief.id)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-white/40 hover:text-red-300 transition-colors"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 border-t border-white/[0.06] pt-3">
          <List label="Key findings" items={brief.keyFindings} />
          <List label="Risks & unknowns" items={brief.risks} />
          <List label="Open questions" items={brief.openQuestions} />
          <List label="Next steps" items={brief.nextSteps} />
          <div className="text-[11px] text-white/35 italic leading-snug">{brief.basis}</div>
        </div>
      )}
    </div>
  );
}

export default function ResearchDesk() {
  const [, navigate] = useLocation();
  const [topic, setTopic] = useState("");
  const [sources, setSources] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [briefs, setBriefs] = useState<ResearchBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/research/briefs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setBriefs(data.briefs || []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load your research");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async () => {
    setError(null);
    if (!topic.trim()) {
      setError("Type a subject for Zed to research.");
      return;
    }
    setWorking(true);
    try {
      const res = await fetch("/api/research/brief", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), sources: sources.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      if (body.brief) setBriefs((prev) => [body.brief as ResearchBrief, ...prev]);
      setTopic("");
      setSources("");
      setShowSources(false);
    } catch (err: any) {
      setError(err?.message || "Zed could not build the brief. Try again.");
    } finally {
      setWorking(false);
    }
  }, [topic, sources]);

  const remove = useCallback(async (id: string) => {
    setBriefs((prev) => prev.filter((b) => b.id !== id));
    try {
      await fetch(`/api/research/briefs/${id}`, { method: "DELETE", credentials: "include" });
    } catch {
      /* optimistic — refresh will reconcile */
    }
  }, []);

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
          <Search size={16} className="text-cyan-300" />
          <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            Research
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
        {/* The working input — hand Zed a subject */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Research desk</div>
          <p className="mt-1 text-[13px] text-white/60 leading-snug">
            Give Zed a subject — a person, company, market, technology, or question. Zed returns a
            working brief you can act on, and it's saved here.
          </p>
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) void run();
              }}
              placeholder="e.g. Competitive landscape for AI trading tools"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/50"
            />
            {showSources ? (
              <textarea
                value={sources}
                onChange={(e) => setSources(e.target.value)}
                rows={4}
                placeholder="Optional: paste notes, an article, or a document for Zed to ground the brief in."
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
                onClick={() => navigate("/chat?ctx=research")}
                className="inline-flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white/80"
              >
                <MessageSquare size={13} />
                Ask Zed directly
              </button>
              <Button
                onClick={() => void run()}
                disabled={working}
                className="rounded-xl zed-gradient"
              >
                <Search size={14} className="mr-1.5" />
                {working ? "Researching…" : "Research it"}
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {working && (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4 text-sm text-cyan-100">
            Zed is working through the subject and structuring a brief…
          </div>
        )}

        <section className="space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Your research {briefs.length > 0 ? `(${briefs.length})` : ""}
          </div>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : briefs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-muted-foreground">
              Nothing here yet. Give Zed a subject above and your briefs will collect here.
            </div>
          ) : (
            <div className="space-y-3">
              {briefs.map((b) => (
                <BriefCard key={b.id} brief={b} onDelete={remove} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
