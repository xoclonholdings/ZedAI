import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Globe, Loader2, Send, Sparkles, User } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { useConsoleBrowser } from "@/console/ConsoleBrowserContext";

interface BrowserVisit {
  id: string;
  url: string;
  title?: string;
  error?: string;
  source: "user" | "zar";
}

interface BrowserSession {
  current: BrowserVisit | null;
  history: BrowserVisit[];
}

const SESSION_QUERY_KEY = ["/api/browser/session"];

function normalizeInputUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * The dock's Browse slot - just the address bar and recent visits. The
 * actual fetched page renders full-size in the console's main content
 * region (ConsoleBrowserFullPage), the same place every other workspace
 * renders, not cramped inside the dock. "Go" (or picking a recent visit)
 * calls POST /api/browser/navigate, which safely fetches the page
 * server-side and records it; the session is polled the same way the dock
 * already polls conversations, so a page ZAR visits on its own (via
 * IntelligenceAgent's research lookups) shows up here too, live.
 */
export function NexusLiveBrowser() {
  const [input, setInput] = useState("");
  const queryClient = useQueryClient();
  const { openFullPage, setLoading } = useConsoleBrowser();

  const { data: session } = useQuery<BrowserSession>({
    queryKey: SESSION_QUERY_KEY,
    refetchInterval: 5000,
  });

  const navigate = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/browser/navigate", { url });
      return res.json();
    },
    onSettled: () => {
      setLoading(false);
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });

  function go(rawUrl?: string) {
    const url = normalizeInputUrl(rawUrl ?? input);
    if (!url || navigate.isPending) return;
    setLoading(true);
    openFullPage();
    navigate.mutate(url);
  }

  const current = session?.current ?? null;
  const history = session?.history ?? [];

  return (
    <div className="flex min-h-[101px] flex-col gap-2 rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5">
          <Globe size={12} className="shrink-0 text-white/40" aria-hidden="true" />
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") go();
            }}
            placeholder="Go to a website..."
            aria-label="Browser address"
            className="w-full bg-transparent text-[12.5px] text-white placeholder:text-white/35 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => go()}
          disabled={navigate.isPending || !input.trim()}
          aria-label="Go"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-black transition hover:bg-cyan-300 disabled:opacity-40"
        >
          {navigate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>

      {current && (
        <button
          type="button"
          onClick={openFullPage}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-left text-[12px] text-white/70 hover:bg-white/5"
        >
          {current.error ? (
            <AlertTriangle size={12} className="shrink-0 text-red-300" aria-hidden="true" />
          ) : current.source === "zar" ? (
            <Sparkles size={12} className="shrink-0 text-violet-300" aria-hidden="true" />
          ) : (
            <User size={12} className="shrink-0 text-cyan-300" aria-hidden="true" />
          )}
          <span className="truncate">{current.error ? "Failed to load" : current.title || current.url}</span>
          <ExternalLink size={11} className="ml-auto shrink-0 text-white/30" aria-hidden="true" />
        </button>
      )}

      {!current && (
        <p className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-center text-[12px] text-white/40">
          Nothing browsed yet - type a URL above, or ask ZAR to look something up.
        </p>
      )}

      {history.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {history.slice(1, 6).map((visit) => (
            <button
              key={visit.id}
              type="button"
              onClick={() => {
                setInput(visit.url);
                go(visit.url);
              }}
              className="max-w-[140px] truncate rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10.5px] text-white/50 hover:bg-white/5"
              title={visit.url}
            >
              {visit.title || visit.url}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
