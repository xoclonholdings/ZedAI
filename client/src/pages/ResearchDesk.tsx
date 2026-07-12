import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ExternalLink, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import WorkspaceLibrary from "@/components/WorkspaceLibrary";

/**
 * The Research (R&D) workspace.
 *
 * Component #1: Search — real web search (Brave/Serper via the existing
 * WebSearchService). Type what you want to know, get results with links.
 * The workspace's own knowledge library sits below it. More R&D tools
 * (news, YouTube, Wikipedia, translate, …) get added here, one at a time.
 */

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export default function ResearchDesk() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setError(null);
    setNote(null);
    if (!query.trim()) {
      setError("Type what you want to search for.");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch("/api/research/search", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setResults(body.results || []);
      setSearched(true);
      if ((body.results || []).length === 0) {
        setNote(
          body.source === "none"
            ? "No search provider is connected yet. Add a Brave or Serper key so Zed can search the web."
            : "No results for that. Try different words.",
        );
      }
    } catch (err: any) {
      setError(err?.message || "Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }, [query]);

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
        <span className="w-14" />
      </div>

      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
        {/* Component #1 — Search */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void run();
                }}
                placeholder="Search the web…"
                className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/50"
              />
            </div>
            <Button onClick={() => void run()} disabled={searching} className="rounded-xl zed-gradient">
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {note && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/60">
            {note}
          </div>
        )}

        {searched && results.length > 0 && (
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Results ({results.length})
            </div>
            <div className="space-y-2">
              {results.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-white/10 bg-black/30 p-3.5 transition-all hover:border-cyan-400/40 hover:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[14px] font-semibold text-white leading-snug">{r.title}</div>
                    <ExternalLink size={13} className="mt-1 shrink-0 text-white/40" />
                  </div>
                  {r.snippet && (
                    <div className="mt-1 text-[12.5px] text-white/55 leading-snug">{r.snippet}</div>
                  )}
                  <div className="mt-1 truncate text-[11px] text-cyan-300/70">{r.url}</div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* The workspace's own knowledge library */}
        <WorkspaceLibrary workspace="research" label="Research library" />
      </main>
    </div>
  );
}
