import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Globe, Loader2, Sparkles, User, X } from "lucide-react";

import { useConsoleBrowser } from "./ConsoleBrowserContext";
import { ConsoleGlassPanel } from "./ConsoleGlassPanel";
import { apiRequest } from "@/lib/queryClient";

interface BrowserVisit {
  id: string;
  url: string;
  kind?: "page" | "search";
  query?: string;
  searchResults?: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  title?: string;
  text?: string;
  sanitizedHtml?: string;
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

/**
 * Wraps the server-sanitized fragment in a minimal dark-themed document for
 * the reader iframe. The iframe itself carries the real security boundary
 * (sandboxed, no scripts) - this is just presentation.
 */
function buildReaderDocument(sanitizedHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; font: 14px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background: transparent; color: rgba(255,255,255,0.85); }
    a { color: #67e8f9; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    h1, h2, h3, h4, h5, h6 { color: #fff; line-height: 1.3; }
    pre { background: rgba(255,255,255,0.06); border-radius: 6px; padding: 10px; overflow-x: auto; }
    code { background: rgba(255,255,255,0.06); border-radius: 4px; padding: 0 3px; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid rgba(255,255,255,0.12); padding: 5px 8px; }
  </style></head><body>${sanitizedHtml}</body></html>`;
}

/**
 * The console's live browser, rendered full-size in the main content region
 * - the same glass surface every workspace uses - instead of the dock's own
 * small slot. The dock (NexysLiveBrowser) only owns the address bar; this
 * owns the actual fetched page, live for both the user's own navigation and
 * whatever ZAR looks up on its own (both write to the same session).
 */
export function ConsoleBrowserFullPage() {
  const { isLoading, closeFullPage, setLoading } = useConsoleBrowser();
  const queryClient = useQueryClient();
  const { data: session } = useQuery<BrowserSession>({
    queryKey: SESSION_QUERY_KEY,
    refetchInterval: 5000,
  });
  const current = session?.current ?? null;
  const navigateResult = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/browser/navigate", { url });
      return response.json();
    },
    onMutate: () => setLoading(true),
    onSettled: () => {
      setLoading(false);
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
  const externalUrl = current?.url && /^https?:\/\//i.test(current.url) ? current.url : null;

  return (
    <ConsoleGlassPanel>
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <Globe size={14} className="shrink-0 text-white/40" aria-hidden="true" />
        {current?.source === "zar" && (
          <Sparkles size={12} className="shrink-0 text-violet-300" aria-label="ZAR visited" />
        )}
        {current?.source === "user" && (
          <User size={12} className="shrink-0 text-cyan-300" aria-label="You visited" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white/90">
            {current?.title || current?.url || "Live Browser"}
          </div>
          {externalUrl && <div className="truncate text-[11px] text-white/40">{externalUrl}</div>}
        </div>
        {externalUrl && !current?.error && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open in a new tab"
            className="shrink-0 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <ExternalLink size={14} />
          </a>
        )}
        <button
          type="button"
          onClick={closeFullPage}
          aria-label="Close browser"
          className="shrink-0 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="relative min-h-[240px] pt-3">
        {isLoading ? (
          <div className="flex h-[240px] items-center justify-center gap-2 text-[13px] text-white/50">
            <Loader2 size={16} className="animate-spin" />
            Loading page…
          </div>
        ) : current?.error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-[13px] text-red-200">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {current.error}
          </div>
        ) : current?.kind === "search" && current.searchResults?.length ? (
          <div className="h-[calc(100dvh-320px)] min-h-[320px] overflow-y-auto divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {current.searchResults.map((result) => (
              <button
                key={result.url}
                type="button"
                onClick={() => navigateResult.mutate(result.url)}
                className="block w-full py-3 text-left transition hover:bg-white/[0.03]"
              >
                <div className="text-[13px] font-medium text-cyan-100">{result.title || result.url}</div>
                <div className="mt-0.5 truncate text-[10.5px] text-white/35">{result.url}</div>
                {result.snippet ? (
                  <p className="mt-1 text-[12px] leading-5 text-white/60">{result.snippet}</p>
                ) : null}
              </button>
            ))}
          </div>
        ) : current?.sanitizedHtml ? (
          <iframe
            title={current.title || current.url}
            srcDoc={buildReaderDocument(current.sanitizedHtml)}
            sandbox="allow-popups"
            referrerPolicy="no-referrer"
            className="h-[calc(100dvh-320px)] min-h-[320px] w-full rounded-xl border-0"
          />
        ) : current?.text ? (
          <p className="max-h-[calc(100dvh-320px)] min-h-[320px] overflow-y-auto whitespace-pre-line text-[13px] leading-relaxed text-white/70">
            {current.text}
          </p>
        ) : (
          <p className="flex h-[240px] items-center justify-center text-center text-[13px] text-white/40">
            Nothing browsed yet - type a URL in the dock's Search bar, or ask ZAR to look something up.
          </p>
        )}
      </div>
    </ConsoleGlassPanel>
  );
}
