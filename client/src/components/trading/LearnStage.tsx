import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";

import type { TradingKnowledgeEntry } from "@shared/trading-types";

import {
  EmptyBox,
  FormField,
  GroupHeading,
  NoticeBanner,
  StageShell,
  inputClass,
  textareaClass,
} from "./stage-atoms";

/**
 * The Learn stage turns real sources (market education, rulebooks,
 * PDFs, videos, books) into structured
 * knowledge ZAR can pull into every later stage.
 *
 * The user pastes what they read; ZAR's TradingKnowledgeBase
 * ingests it into concepts/rules/examples with tags so retrieval
 * stays clean.
 */

const SOURCE_OPTIONS = [
  { value: "Trades By Sci", type: "trades_by_sci" },
  { value: "Investopedia", type: "investopedia" },
  { value: "Babypips", type: "babypips" },
  { value: "Book", type: "book" },
  { value: "PDF", type: "pdf" },
  { value: "Video", type: "video" },
  { value: "Article", type: "article" },
  { value: "Other", type: "other" },
];

const EMPTY_FORM = {
  source: "Trades By Sci",
  sourceType: "trades_by_sci",
  title: "",
  text: "",
  tags: "",
};

function friendlyCategory(cat?: string): string {
  if (!cat) return "";
  return cat
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function knowledgePreview(entry: TradingKnowledgeEntry): string {
  return [
    ...entry.concepts,
    ...entry.definitions,
    ...entry.rules,
    ...entry.patterns,
    ...entry.entryCriteria,
    ...entry.riskRules,
    ...entry.bestPractices,
    ...entry.examples,
  ].find((item) => item.trim().length > 0) || "";
}

export default function LearnStage() {
  const [entries, setEntries] = useState<TradingKnowledgeEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const url = query.trim()
        ? `/api/trading/knowledge?query=${encodeURIComponent(query.trim())}`
        : "/api/trading/knowledge";
      const res = await fetch(url, { credentials: "include", signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Could not load knowledge (HTTP ${res.status})`);
      }
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "Failed to load knowledge");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query]);

  // Debounced + stale-response-safe: typing quickly cancels the previous
  // in-flight search instead of racing it, so a slower earlier response
  // can never overwrite the result of what's currently in the box.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void refresh(controller.signal), query ? 300 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [refresh, query]);

  const submit = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!form.text.trim()) {
      setError("Paste at least a paragraph of what you learned.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/trading/knowledge/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: form.source,
          sourceType: form.sourceType,
          title: form.title.trim() || undefined,
          text: form.text.trim(),
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNotice("Knowledge stored. ZAR will use it in later stages.");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }, [form, refresh]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      const c = e.category || "uncategorized";
      map[c] = (map[c] || 0) + 1;
    }
    return map;
  }, [entries]);

  const grouped = useMemo(() => {
    const groups: Record<string, TradingKnowledgeEntry[]> = {};
    for (const e of entries) {
      const c = e.category || "uncategorized";
      if (!groups[c]) groups[c] = [];
      groups[c].push(e);
    }
    return groups;
  }, [entries]);

  // Categories ordered by size (biggest first) for the filter row.
  const categories = useMemo(
    () => Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]),
    [categoryCounts],
  );

  // If the active category disappears (e.g. after a text search), reset it.
  useEffect(() => {
    if (activeCategory && !categoryCounts[activeCategory]) setActiveCategory(null);
  }, [activeCategory, categoryCounts]);

  const visibleGroups = useMemo(() => {
    if (!activeCategory) return Object.entries(grouped);
    const list = grouped[activeCategory];
    return list ? [[activeCategory, list] as [string, TradingKnowledgeEntry[]]] : [];
  }, [grouped, activeCategory]);

  return (
    <StageShell
      eyebrow="Learn"
      title="Your trading library"
      description="Bring in what you read, watch, or take notes on. ZAR structures it into concepts, rules, and examples so every later stage can reference the source."
      onRefresh={() => void refresh()}
      refreshing={loading}
      action={
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors active:opacity-80"
        >
          <Plus size={13} />
          {showForm ? "Cancel" : "Add knowledge"}
        </button>
      }
    >
      {notice && <NoticeBanner kind="success">{notice}</NoticeBanner>}
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}

      {showForm && (
        <div className="mb-5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold text-white">Add knowledge</div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-white/50 hover:text-white/80"
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <FormField label="Source">
              <select
                value={form.source}
                onChange={(e) => {
                  const src = SOURCE_OPTIONS.find((s) => s.value === e.target.value);
                  setForm({
                    ...form,
                    source: e.target.value,
                    sourceType: src?.type || form.sourceType,
                  });
                }}
                className={inputClass}
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-neutral-900">
                    {s.value}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Title (optional)">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Bank & sweep behavior on ES"
                className={inputClass}
              />
            </FormField>
          </div>
          <div className="mt-3">
            <FormField label="What did you learn? (paste notes, transcript, or your summary)">
              <textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                rows={6}
                placeholder="Institutions sweep resting stops during liquidity events. Look for a sharp move beyond a prior high/low followed by a reversal — that's the sweep, not the trend."
                className={textareaClass}
              />
            </FormField>
          </div>
          <div className="mt-3">
            <FormField label="Tags (comma separated)">
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="liquidity, market-structure, sweep"
                className={inputClass}
              />
            </FormField>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes or tags"
            className={`${inputClass} pl-8`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="text-[12px] text-white/40 whitespace-nowrap">
          {entries.length} in library
        </div>
      </div>

      {categories.length > 1 && (
        <div className="mb-4 -mx-0.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
              activeCategory === null
                ? "bg-cyan-400 text-black font-medium"
                : "bg-white/[0.05] text-white/60 hover:text-white"
            }`}
          >
            All ({entries.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory((c) => (c === cat ? null : cat))}
              className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                activeCategory === cat
                  ? "bg-cyan-400 text-black font-medium"
                  : "bg-white/[0.05] text-white/60 hover:text-white"
              }`}
            >
              {friendlyCategory(cat)} ({categoryCounts[cat]})
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyBox>
          Nothing here yet. Tap Add knowledge and paste what you're studying.
        </EmptyBox>
      ) : (
        visibleGroups.map(([category, list]) => (
          <div key={category} className="mb-5">
            <GroupHeading label={friendlyCategory(category)} count={categoryCounts[category]} />
            <div className="space-y-1.5">
              {list.map((entry) => {
                const preview = knowledgePreview(entry);
                return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-white">
                        {entry.title || preview.slice(0, 60) || "Untitled note"}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-white/45">
                        {entry.source} · {friendlyCategory(entry.category)}
                      </div>
                    </div>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {entry.tags.slice(0, 3).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setQuery(t)}
                            title={`Search “${t}”`}
                            className="text-[10px] uppercase tracking-[0.06em] bg-white/[0.06] text-white/60 rounded-full px-2 py-0.5 hover:bg-cyan-400/20 hover:text-cyan-200 transition-colors"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {preview && (
                    <div className="mt-1.5 text-[12px] text-white/60 leading-snug max-w-[80ch]">
                      {preview.slice(0, 220)}
                      {preview.length > 220 ? "…" : ""}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </StageShell>
  );
}
