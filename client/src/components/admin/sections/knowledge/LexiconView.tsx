import { useEffect, useMemo, useState } from "react";
import { Check, Languages, Search, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { MetricCard } from "./atoms";

type LexiconDomain = { id: string; label: string; description: string; community: boolean; entryCount: number };

type LexiconEntry = {
  id: string;
  term: string;
  definition: string;
  alternateDefinitions: string[];
  domains: string[];
  communities: string[];
  authority: string;
  status: "candidate" | "verified" | "deprecated" | "rejected";
  confidence: number;
  exampleUsage: string[];
  notes: string;
};

type LexiconOverview = {
  totalEntries: number;
  verifiedEntries: number;
  candidateEntries: number;
  deprecatedEntries: number;
  domainCount: number;
  relationshipCount: number;
};

const AUTHORITY_LABELS: Record<string, string> = {
  standard_dictionary: "Standard Dictionary",
  scientific: "Scientific",
  legal: "Legal",
  medical: "Medical",
  financial: "Financial",
  programming: "Programming",
  ballroom_community: "Ballroom Community",
  black_vernacular: "Black Vernacular",
  lgbtq_terminology: "LGBTQ+ Terminology",
  internet_culture: "Internet Culture",
  zar_internal: "ZAR Internal",
  zwap_internal: "ZWAP Internal",
  zcos_internal: "ZCOS Internal",
  z_citi_internal: "Z-Citi Internal",
  user_defined: "User Defined",
  verified_user: "Verified User",
  external_reference: "External Reference",
};

function EntryCard({ entry }: { entry: LexiconEntry }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">{entry.term}</div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="border-cyan-400/25 text-cyan-300">
            {AUTHORITY_LABELS[entry.authority] || entry.authority}
          </Badge>
          {entry.status !== "verified" ? (
            <Badge
              variant="outline"
              className={
                entry.status === "candidate"
                  ? "border-amber-400/25 text-amber-300"
                  : "border-red-400/25 text-red-300"
              }
            >
              {entry.status}
            </Badge>
          ) : null}
        </div>
      </div>
      <p className="text-sm leading-6 text-foreground/85">{entry.definition || "No definition recorded yet."}</p>
      {entry.domains.length || entry.communities.length ? (
        <div className="flex flex-wrap gap-1.5">
          {[...entry.domains, ...entry.communities].map((tag) => (
            <Badge key={tag} variant="outline" className="border-white/10 text-[11px] text-muted-foreground">
              {tag.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      ) : null}
      {entry.exampleUsage.length > 0 ? (
        <div className="text-xs italic text-muted-foreground">"{entry.exampleUsage[0]}"</div>
      ) : null}
    </div>
  );
}

export function LexiconView() {
  const [overview, setOverview] = useState<LexiconOverview | null>(null);
  const [domains, setDomains] = useState<LexiconDomain[]>([]);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<LexiconEntry[]>([]);
  const [candidates, setCandidates] = useState<LexiconEntry[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void loadDomains();
    void loadCandidates();
    void loadOverview();
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDomain]);

  async function loadOverview() {
    try {
      const res = await fetch("/api/lexicon/overview", { credentials: "include" });
      if (res.ok) setOverview((await res.json()).overview);
    } catch {
      /* metrics row shows a dash on failure */
    }
  }

  async function loadDomains() {
    try {
      const res = await fetch("/api/lexicon/domains", { credentials: "include" });
      if (res.ok) setDomains((await res.json()).domains || []);
    } catch {
      /* domain chips stay empty on failure */
    }
  }

  async function loadCandidates() {
    try {
      const res = await fetch("/api/lexicon/candidates", { credentials: "include" });
      if (res.ok) setCandidates((await res.json()).entries || []);
    } catch {
      /* candidate queue stays empty on failure */
    }
  }

  async function search() {
    setSearching(true);
    try {
      const url = activeDomain
        ? `/api/lexicon/domains/${encodeURIComponent(activeDomain)}/search?q=${encodeURIComponent(query.trim())}`
        : `/api/lexicon/search?q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) setEntries((await res.json()).entries || []);
    } catch {
      /* results panel simply shows nothing on failure */
    }
    setSearching(false);
  }

  async function reviewCandidate(id: string, action: "confirm" | "reject") {
    try {
      const res = await fetch(`/api/lexicon/entries/${id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("review failed");
      await Promise.all([loadCandidates(), loadOverview(), search()]);
    } catch {
      /* candidate stays in the queue so the admin can retry */
    }
  }

  const communityDomains = useMemo(() => domains.filter((domain) => domain.community), [domains]);
  const fieldDomains = useMemo(() => domains.filter((domain) => !domain.community), [domains]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Verified Terms" value={overview?.verifiedEntries ?? "—"} />
        <MetricCard label="Candidate Terms" value={overview?.candidateEntries ?? "—"} />
        <MetricCard label="Domains" value={overview?.domainCount ?? "—"} />
        <MetricCard label="Relationships" value={overview?.relationshipCount ?? "—"} />
      </div>

      <Card className="zar-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Languages size={16} className="text-cyan-300" />
            Search the Lexicon
          </CardTitle>
          <CardDescription>
            Look up how ZAR interprets a word or phrase — its meanings, which community or domain
            each meaning comes from, and how confident ZAR is in it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search a term, definition, domain, or community..."
              className="border-white/10 bg-black/30 text-sm"
            />
            <Button onClick={search} disabled={searching}>
              <Search size={14} className="mr-2" />
              {searching ? "Searching..." : "Search"}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Domains
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setActiveDomain(null)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  activeDomain === null
                    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                    : "border-white/10 text-muted-foreground hover:border-white/20"
                }`}
              >
                All
              </button>
              {[...fieldDomains, ...communityDomains].map((domain) => (
                <button
                  key={domain.id}
                  type="button"
                  onClick={() => setActiveDomain(domain.id)}
                  title={domain.description}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    activeDomain === domain.id
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  {domain.label}
                  {domain.entryCount ? <span className="ml-1 opacity-60">({domain.entryCount})</span> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {entries.length > 0 ? (
              entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)
            ) : (
              <div className="text-sm text-muted-foreground">
                No entries match yet. Try a broader search or clear the domain filter.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="zar-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles size={16} className="text-purple-300" />
            Discovered Terms Awaiting Review
          </CardTitle>
          <CardDescription>
            ZAR noticed these terms in conversation and doesn't have a confirmed meaning yet.
            Confirm to add them to the lexicon, or reject if they're not worth tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {candidates.length > 0 ? (
            candidates.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-amber-400/20 bg-black/25 p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{entry.term}</div>
                    <div className="text-xs text-muted-foreground">
                      Confidence: {Math.round(entry.confidence * 100)}% · Evidence collected from conversation
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-400/25 text-emerald-300 hover:bg-emerald-400/10"
                      onClick={() => reviewCandidate(entry.id, "confirm")}
                    >
                      <Check size={12} className="mr-1" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/20 text-red-300 hover:bg-red-500/10"
                      onClick={() => reviewCandidate(entry.id, "reject")}
                    >
                      <X size={12} className="mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
                {entry.definition ? (
                  <p className="text-sm text-foreground/85">{entry.definition}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">No definition guessed yet — review the source conversation before confirming.</p>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">Nothing pending review right now.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
