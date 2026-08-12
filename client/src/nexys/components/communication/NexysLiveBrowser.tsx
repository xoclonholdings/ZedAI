import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Loader2, Send, Star } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { useConsoleBrowser } from "@/console/ConsoleBrowserContext";

interface BrowserVisit {
  id: string;
  url: string;
  kind?: "page" | "search";
  error?: string;
}

interface BrowserSession {
  current: BrowserVisit | null;
  history: BrowserVisit[];
}

interface UgcWebsitesResponse {
  items: Array<{ id: string; url: string }>;
}

const SESSION_QUERY_KEY = ["/api/browser/session"];
const UGC_WEBSITES_QUERY_KEY = ["/api/knowledge/ugc/websites"];

function looksLikeWebsite(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || /^(?:localhost|(?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#]|$)/i.test(trimmed);
}

function normalizeWebsiteUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function comparableWebsiteUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value;
  }
}

/** Search/address input and UGC save action. Browser output stays in the console. */
export function NexysLiveBrowser() {
  const [input, setInput] = useState("");
  const queryClient = useQueryClient();
  const { openFullPage, setLoading } = useConsoleBrowser();

  const { data: session } = useQuery<BrowserSession>({
    queryKey: SESSION_QUERY_KEY,
    refetchInterval: 5000,
  });
  const { data: ugcWebsites } = useQuery<UgcWebsitesResponse>({
    queryKey: UGC_WEBSITES_QUERY_KEY,
  });

  const runSearch = useMutation({
    mutationFn: async (value: string) => {
      const website = looksLikeWebsite(value);
      const response = await apiRequest(
        "POST",
        website ? "/api/browser/navigate" : "/api/browser/search",
        website ? { url: normalizeWebsiteUrl(value) } : { query: value.trim() },
      );
      return response.json();
    },
    onSettled: () => {
      setLoading(false);
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });

  const saveWebsite = useMutation({
    mutationFn: async (visitId: string) => {
      const response = await apiRequest("POST", "/api/knowledge/ugc/websites/from-browser", { visitId });
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: UGC_WEBSITES_QUERY_KEY }),
  });

  function go() {
    const value = input.trim();
    if (!value || runSearch.isPending) return;
    setLoading(true);
    openFullPage();
    runSearch.mutate(value);
  }

  const current = session?.current ?? null;
  const canSaveCurrent = Boolean(
    current && current.kind !== "search" && !current.error && /^https?:\/\//i.test(current.url),
  );
  const currentSaved = Boolean(
    canSaveCurrent && current && ugcWebsites?.items.some(
      (item) => comparableWebsiteUrl(item.url) === comparableWebsiteUrl(current.url),
    ),
  );

  return (
    <div className="flex min-h-[101px] items-center rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="flex w-full items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5">
          <Globe size={12} className="shrink-0 text-white/40" aria-hidden="true" />
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") go();
            }}
            placeholder="Search or enter a website..."
            aria-label="Search or website address"
            className="w-full bg-transparent text-[12.5px] text-white placeholder:text-white/35 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={go}
          disabled={runSearch.isPending || !input.trim()}
          aria-label="Search"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-black transition hover:bg-cyan-300 disabled:opacity-40"
        >
          {runSearch.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
        <button
          type="button"
          onClick={() => current && saveWebsite.mutate(current.id)}
          disabled={!canSaveCurrent || saveWebsite.isPending}
          aria-label={currentSaved ? "Saved to Knowledge UGC" : "Save website to Knowledge UGC"}
          aria-pressed={currentSaved}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/55 transition hover:border-cyan-200/30 hover:text-cyan-100 disabled:opacity-30"
        >
          {saveWebsite.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Star size={14} fill={currentSaved ? "currentColor" : "none"} />
          )}
        </button>
      </div>
    </div>
  );
}
