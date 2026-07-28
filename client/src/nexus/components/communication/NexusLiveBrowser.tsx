import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Globe, Loader2, Send, Sparkles, User } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";

interface BrowserVisit {
  id: string;
  url: string;
  title?: string;
  text?: string;
  status?: number;
  error?: string;
  source: "user" | "zar";
  visitedAt: string;
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
 * The console's live browser. Real fetches, not a mock: "Go" (or picking a
 * recent visit) calls POST /api/browser/navigate, which safely fetches the
 * page server-side and records it. The session is polled the same way the
 * dock already polls conversations, so a page ZAR visits on its own (via
 * IntelligenceAgent's research lookups) shows up here too, live, without the
 * user having to do anything.
 */
export function NexusLiveBrowser() {
  const [input, setInput] = useState("");
  const queryClient = useQueryClient();

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
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });

  function go(rawUrl?: string) {
    const url = normalizeInputUrl(rawUrl ?? input);
    if (!url || navigate.isPending) return;
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

      {current ? (
        <div className="max-h-[220px] overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-white/40">
            {current.source === "zar" ? (
              <Sparkles size={11} className="shrink-0 text-violet-300" aria-hidden="true" />
            ) : (
              <User size={11} className="shrink-0 text-cyan-300" aria-hidden="true" />
            )}
            {current.source === "zar" ? "ZAR visited" : "You visited"}
          </div>
          {current.error ? (
            <div className="flex items-start gap-1.5 text-[12.5px] text-red-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              {current.error}
            </div>
          ) : (
            <>
              <a
                href={current.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[13px] font-medium text-cyan-100 hover:text-cyan-50"
              >
                <span className="truncate">{current.title || current.url}</span>
                <ExternalLink size={11} className="shrink-0 text-white/40" aria-hidden="true" />
              </a>
              <div className="mt-0.5 truncate text-[11px] text-white/40">{current.url}</div>
              {current.text && (
                <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-white/70">
                  {current.text.slice(0, 600)}
                  {current.text.length > 600 ? "…" : ""}
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-white/10 bg-black/30 p-3 text-center text-[12px] text-white/40">
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
