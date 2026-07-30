import { useCallback, useEffect, useState } from "react";
import { Bookmark, ExternalLink, RotateCcw, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import WorkspaceLibrary from "@/components/WorkspaceLibrary";
import ResearchDocuments from "@/components/research/ResearchDocuments";

/**
 * The Research workspace.
 *
 * Search is the front door. After ZAR looks something up, he offers a few
 * plain things to do with it — give the short version, check if it's
 * legit, save it for later, or whatever you type. Or nothing.
 */

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SavedItem {
  id: string;
  createdAt: string;
  query: string;
  note: string;
  results: SearchResult[];
}

export default function ResearchDesk() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [lastQuery, setLastQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [zarText, setZarText] = useState<string | null>(null);
  const [zarFailed, setZarFailed] = useState(false);
  const [lastAct, setLastAct] = useState<{ action: "summarize" | "verify" | "other"; instruction?: string } | null>(null);

  const [saved, setSaved] = useState<SavedItem[]>([]);

  const loadSaved = useCallback(async () => {
    try {
      const res = await fetch("/api/research/saved", { credentials: "include" });
      if (res.ok) setSaved((await res.json()).items || []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const run = useCallback(async () => {
    setError(null);
    setNote(null);
    setZarText(null);
    if (!query.trim()) {
      setError("Type what you want to look up.");
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
      setLastQuery(query.trim());
      setSearched(true);
      setSuggestOpen((body.results || []).length > 0);
      setOtherOpen(false);
      if ((body.results || []).length === 0) {
        setNote(
          body.source === "none"
            ? "No search is connected yet. Add a Brave or Serper key so ZAR can look things up."
            : "Nothing came back for that. Try different words.",
        );
      }
    } catch {
      setError("I couldn't run that search just now. Give it another go in a moment.");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const act = useCallback(
    async (action: "summarize" | "verify" | "other", instruction?: string) => {
      setError(null);
      setBusy(action);
      setZarText(null);
      setZarFailed(false);
      setLastAct({ action, instruction });
      try {
        const res = await fetch("/api/research/act", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, query: lastQuery, results, instruction }),
        });
        const body = await res.json().catch(() => ({}));
        // ZAR always speaks in plain language via body.text; body.ok tells
        // us whether it worked so we can show a "try again".
        setZarText(body.text || "I couldn't finish that. Mind trying again?");
        setZarFailed(body.ok === false);
        if (body.ok !== false) {
          setOtherOpen(false);
          setOtherText("");
        }
      } catch {
        setZarText("I couldn't reach my brain just now. Give it a moment and try again.");
        setZarFailed(true);
      } finally {
        setBusy(null);
      }
    },
    [lastQuery, results],
  );

  const save = useCallback(async () => {
    setBusy("save");
    try {
      const res = await fetch("/api/research/saved", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: lastQuery, note: zarText || "", results }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.item) {
        setSaved((prev) => [body.item as SavedItem, ...prev]);
        setNote("Saved. You'll find it below whenever you come back.");
      }
    } catch {
      setError("Couldn't save that. Try again.");
    } finally {
      setBusy(null);
    }
  }, [lastQuery, zarText, results]);

  const removeSaved = useCallback(async (id: string) => {
    setSaved((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/research/saved/${id}`, { method: "DELETE", credentials: "include" });
    } catch {
      /* optimistic */
    }
  }, []);

  const chip =
    "rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[12.5px] text-white/80 hover:bg-white/10 disabled:opacity-50 transition-colors";

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-4 backdrop-blur-md shadow-[0_0_40px_rgba(139,0,255,0.15)]">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void run();
              }}
              placeholder="Look something up…"
              className="zed-input w-full rounded-xl pl-9 pr-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30"
            />
          </div>
          <Button onClick={() => void run()} disabled={searching} className="rounded-xl zed-gradient">
            {searching ? "Looking…" : "Search"}
          </Button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>
      )}
      {note && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/60">{note}</div>
      )}

      {/* ZAR's "want me to…" suggestions */}
      {suggestOpen && (
        <div className="zed-glow rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
          <div className="text-[13px] text-white/80 mb-2">Want me to…</div>
          <div className="flex flex-wrap gap-2">
            <button className={chip} disabled={!!busy} onClick={() => void act("summarize")}>
              {busy === "summarize" ? "…" : "Summarize it"}
            </button>
            <button className={chip} disabled={!!busy} onClick={() => void act("verify")}>
              {busy === "verify" ? "…" : "Check if it's legit"}
            </button>
            <button className={chip} disabled={!!busy} onClick={() => void save()}>
              {busy === "save" ? "…" : "Save it for later"}
            </button>
            <button className={chip} disabled={!!busy} onClick={() => setOtherOpen((v) => !v)}>
              Something else
            </button>
            <button
              className={chip}
              onClick={() => {
                setSuggestOpen(false);
                setZarText(null);
                setOtherOpen(false);
              }}
            >
              No thanks
            </button>
          </div>
          {otherOpen && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && otherText.trim()) void act("other", otherText.trim());
                }}
                placeholder="Tell ZAR what to do with this…"
                className="zed-input flex-1 rounded-lg px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30"
              />
              <button
                className={chip}
                disabled={!otherText.trim() || !!busy}
                onClick={() => void act("other", otherText.trim())}
              >
                {busy === "other" ? "…" : "Go"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ZAR's answer */}
      {zarText && (
        <div
          className={`rounded-2xl border p-4 backdrop-blur-md ${
            zarFailed
              ? "border-amber-400/30 bg-amber-400/[0.05]"
              : "border-purple-500/20 bg-black/70 shadow-[0_0_15px_rgba(139,0,255,0.3)]"
          }`}
        >
          <div className="whitespace-pre-line text-[13.5px] text-white/85 leading-relaxed">{zarText}</div>
          <div className="mt-3 flex justify-end gap-2">
            {zarFailed ? (
              <button
                className={chip}
                disabled={!!busy}
                onClick={() => lastAct && void act(lastAct.action, lastAct.instruction)}
              >
                <RotateCcw size={12} className="inline mr-1" />
                {busy ? "Trying…" : "Try again"}
              </button>
            ) : (
              <button className={chip} disabled={!!busy} onClick={() => void save()}>
                <Bookmark size={12} className="inline mr-1" />
                {busy === "save" ? "Saving…" : "Save this"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
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
                className="zed-glass block rounded-2xl p-3.5 transition-all hover:shadow-[0_0_22px_rgba(103,232,249,0.25)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[14px] font-semibold text-white leading-snug">{r.title}</div>
                  <ExternalLink size={13} className="mt-1 shrink-0 text-white/40" />
                </div>
                {r.snippet && <div className="mt-1 text-[12.5px] text-white/55 leading-snug">{r.snippet}</div>}
                <div className="mt-1 truncate text-[11px] text-cyan-300/70">{r.url}</div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Saved for later */}
      {saved.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Saved for later</div>
          <div className="space-y-2">
            {saved.map((s) => (
              <div key={s.id} className="zed-glass rounded-2xl p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-white">
                      <Bookmark size={12} className="text-cyan-300" />
                      {s.query || "Saved"}
                    </div>
                    {s.note && (
                      <div className="mt-1 whitespace-pre-line text-[12.5px] text-white/60 leading-snug">
                        {s.note}
                      </div>
                    )}
                    {s.results?.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {s.results.slice(0, 3).map((r, i) => (
                          <a
                            key={i}
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-[11.5px] text-cyan-300/70 hover:text-cyan-200"
                          >
                            {r.title || r.url}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => void removeSaved(s.id)}
                    className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-white/40 hover:text-red-300"
                    aria-label="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ResearchDocuments
        seedInstruction={lastQuery ? `Write up my research on "${lastQuery}".` : ""}
        seedSources={
          zarText ||
          (results.length > 0
            ? results.map((r) => `- ${r.title}\n  ${r.snippet}\n  ${r.url}`).join("\n")
            : "")
        }
      />

      <WorkspaceLibrary workspace="research" label="Research library" />
    </main>
  );
}
