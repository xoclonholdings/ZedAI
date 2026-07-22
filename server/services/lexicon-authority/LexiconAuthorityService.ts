import { loadLexiconDomains } from "./domains";
import { loadLexiconStore, saveLexiconStore, type LexiconStore } from "./store";
import {
  LEXICON_AUTHORITIES,
  type LexiconAuthoritySource,
  type LexiconDomain,
  type LexiconEntry,
  type LexiconPhraseResolution,
  type LexiconRelationship,
  type LexiconResolution,
  type LexiconResolutionContext,
  type LexiconSenseMatch,
  type LexiconTextResolution,
  type RegisterCandidateInput,
} from "./types";
import { nowIso, normalizeKey, normalizeSpace, stableId } from "./util";

const AUTHORITY_LABELS: Record<LexiconAuthoritySource, string> = {
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

const STATUS_WEIGHT: Record<LexiconEntry["status"], number> = {
  verified: 1,
  candidate: 0.55,
  deprecated: 0.2,
  rejected: 0,
};

const UNRESOLVED_SIGNAL_PATTERNS = [
  /what(?:'s| is| does) ["'‘“]?([a-z0-9][a-z0-9 _-]{1,32}?)["'’”]? mean/gi,
  /define ["'‘“]?([a-z0-9][a-z0-9 _-]{1,32}?)["'’”]?(?:[.?!]|$)/gi,
  /["'‘“]([a-z0-9][a-z0-9 _-]{1,32}?)["'’”]/gi,
];

const MAX_NGRAM = 3;
const MAX_TEXT_RESOLUTIONS = 6;
const MAX_UNRESOLVED_SIGNALS = 5;

function requireUserId(value: unknown, operation: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${operation} requires an authenticated userId.`);
  }
  return value.trim();
}

function candidateKeys(entry: LexiconEntry): Array<{ key: string; matchedOn: LexiconSenseMatch["matchedOn"] }> {
  const keys: Array<{ key: string; matchedOn: LexiconSenseMatch["matchedOn"] }> = [
    { key: normalizeKey(entry.canonicalForm), matchedOn: "canonicalForm" },
    { key: normalizeKey(entry.term), matchedOn: "term" },
  ];
  for (const variant of entry.variants) keys.push({ key: normalizeKey(variant), matchedOn: "variant" });
  for (const abbreviation of entry.abbreviations) keys.push({ key: normalizeKey(abbreviation), matchedOn: "abbreviation" });
  for (const acronym of entry.acronyms) keys.push({ key: normalizeKey(acronym), matchedOn: "acronym" });
  for (const synonym of entry.synonyms) keys.push({ key: normalizeKey(synonym), matchedOn: "synonym" });
  return keys.filter((item) => item.key.length > 0);
}

function scoreEntry(
  entry: LexiconEntry,
  matchedOn: LexiconSenseMatch["matchedOn"],
  context?: LexiconResolutionContext,
): number {
  let score = entry.confidence * STATUS_WEIGHT[entry.status];
  const contextText = context?.conversationText ? normalizeKey(context.conversationText) : "";
  if (context?.domain && entry.domains.includes(context.domain)) score += 0.3;
  if (context?.community && entry.communities.includes(context.community)) score += 0.3;
  if (contextText) {
    if (entry.domains.some((domain) => contextText.includes(domain.replace(/_/g, " ")))) score += 0.1;
    if (entry.communities.some((community) => contextText.includes(community.replace(/_/g, " ")))) score += 0.15;
  }
  if (matchedOn === "canonicalForm" || matchedOn === "term") score += 0.05;
  return Number(score.toFixed(4));
}

function matchesForTerm(
  store: LexiconStore,
  rawTerm: string,
  context?: LexiconResolutionContext,
): LexiconSenseMatch[] {
  const key = normalizeKey(rawTerm);
  if (!key) return [];
  const matches: LexiconSenseMatch[] = [];
  for (const entry of store.entries) {
    if (entry.status === "rejected") continue;
    let bestMatchedOn: LexiconSenseMatch["matchedOn"] | null = null;
    for (const candidate of candidateKeys(entry)) {
      if (candidate.key === key) {
        bestMatchedOn = candidate.matchedOn;
        break;
      }
    }
    if (!bestMatchedOn) continue;
    matches.push({ entry, score: scoreEntry(entry, bestMatchedOn, context), matchedOn: bestMatchedOn });
  }
  return matches.sort((a, b) => b.score - a.score);
}

function buildResolution(term: string, matches: LexiconSenseMatch[]): LexiconResolution {
  if (matches.length === 0) {
    return { term, found: false, selected: null, alternates: [], status: "unknown" };
  }
  const [top, second] = matches;
  const ambiguous = Boolean(second) && top.score - second.score < 0.25;
  return {
    term,
    found: true,
    selected: top,
    alternates: matches.slice(1, 5),
    status: ambiguous ? "ambiguous" : "resolved",
  };
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let col = 0; col < cols; col += 1) grid[0][col] = col;
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      grid[row][col] = Math.min(grid[row - 1][col] + 1, grid[row][col - 1] + 1, grid[row - 1][col - 1] + cost);
    }
  }
  return grid[rows - 1][cols - 1];
}

function describeSense(match: LexiconSenseMatch): string {
  const entry = match.entry;
  const label = AUTHORITY_LABELS[entry.authority];
  const domainLabel = entry.domains.length ? entry.domains.join(", ") : "general";
  const statusTag = entry.status === "candidate" ? " [candidate]" : entry.status === "deprecated" ? " [deprecated]" : "";
  return `"${entry.term}" (${label}; ${domainLabel})${statusTag}: ${entry.definition}`;
}

function extractUnresolvedSignals(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of UNRESOLVED_SIGNAL_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const candidate = normalizeSpace(match[1] || "").toLowerCase();
      if (candidate && candidate.length >= 2 && candidate.length <= 40) found.add(candidate);
      if (found.size >= MAX_UNRESOLVED_SIGNALS * 2) break;
    }
  }
  return Array.from(found);
}

export class LexiconAuthorityService {
  static async listDomains(): Promise<Array<LexiconDomain & { entryCount: number }>> {
    const [domains, store] = await Promise.all([loadLexiconDomains(), loadLexiconStore()]);
    return domains.map((domain) => ({
      ...domain,
      entryCount: store.entries.filter((entry) => entry.domains.includes(domain.id) && entry.status !== "rejected").length,
    }));
  }

  static listAuthorities(): Array<{ id: LexiconAuthoritySource; label: string }> {
    return LEXICON_AUTHORITIES.map((id) => ({ id, label: AUTHORITY_LABELS[id] }));
  }

  static async getOverview(): Promise<{
    totalEntries: number;
    verifiedEntries: number;
    candidateEntries: number;
    deprecatedEntries: number;
    rejectedEntries: number;
    relationshipCount: number;
    domainCount: number;
  }> {
    const [store, domains] = await Promise.all([loadLexiconStore(), loadLexiconDomains()]);
    const byStatus = (status: LexiconEntry["status"]) => store.entries.filter((entry) => entry.status === status).length;
    return {
      totalEntries: store.entries.length,
      verifiedEntries: byStatus("verified"),
      candidateEntries: byStatus("candidate"),
      deprecatedEntries: byStatus("deprecated"),
      rejectedEntries: byStatus("rejected"),
      relationshipCount: store.relationships.length,
      domainCount: domains.length,
    };
  }

  static async listCandidates(limit = 25): Promise<LexiconEntry[]> {
    const store = await loadLexiconStore();
    return store.entries
      .filter((entry) => entry.status === "candidate")
      .sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt)))
      .slice(0, limit);
  }

  static async resolveTerm(term: string, context?: LexiconResolutionContext): Promise<LexiconResolution> {
    const store = await loadLexiconStore();
    return buildResolution(term, matchesForTerm(store, term, context));
  }

  static async resolvePhrase(phrase: string, context?: LexiconResolutionContext): Promise<LexiconPhraseResolution> {
    const store = await loadLexiconStore();
    const resolution = buildResolution(phrase, matchesForTerm(store, phrase, context));
    return { ...resolution, phrase };
  }

  static async resolveMeaning(
    entryIds: string[],
    context?: LexiconResolutionContext,
  ): Promise<{ selected: LexiconSenseMatch | null; ranked: LexiconSenseMatch[] }> {
    const store = await loadLexiconStore();
    const ranked = entryIds
      .map((id) => store.entries.find((entry) => entry.id === id))
      .filter((entry): entry is LexiconEntry => Boolean(entry))
      .map((entry) => ({ entry, score: scoreEntry(entry, "canonicalForm", context), matchedOn: "canonicalForm" as const }))
      .sort((a, b) => b.score - a.score);
    return { selected: ranked[0] || null, ranked };
  }

  static async suggestMeaning(
    term: string,
    context?: LexiconResolutionContext,
  ): Promise<LexiconResolution & { suggested: boolean }> {
    const resolution = await this.resolveTerm(term, context);
    if (resolution.found) return { ...resolution, suggested: false };

    const store = await loadLexiconStore();
    const key = normalizeKey(term);
    const neighbors = store.entries
      .filter((entry) => entry.status !== "rejected")
      .map((entry) => ({
        entry,
        distance: levenshtein(key, normalizeKey(entry.canonicalForm)),
      }))
      .filter((item) => item.entry.canonicalForm.length > 0 && item.distance <= Math.max(2, Math.floor(key.length * 0.4)))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((item) => ({
        entry: item.entry,
        score: Number((1 - item.distance / Math.max(key.length, item.entry.canonicalForm.length, 1)).toFixed(4)),
        matchedOn: "canonicalForm" as const,
      }));

    return {
      term,
      found: false,
      selected: null,
      alternates: neighbors,
      status: "unknown",
      suggested: neighbors.length > 0,
    };
  }

  static async searchLexicon(query: string, options?: { includeCandidates?: boolean; limit?: number }): Promise<LexiconEntry[]> {
    const store = await loadLexiconStore();
    const key = normalizeKey(query);
    const includeCandidates = options?.includeCandidates !== false;
    const limit = options?.limit ?? 25;
    const pool = store.entries.filter((entry) => {
      if (entry.status === "rejected") return false;
      if (entry.status === "candidate" && !includeCandidates) return false;
      return true;
    });
    if (!key) return pool.slice(0, limit);
    return pool
      .map((entry) => {
        const haystack = normalizeKey(
          [entry.term, entry.definition, ...entry.alternateDefinitions, ...entry.synonyms, ...entry.domains, ...entry.communities, entry.notes].join(" "),
        );
        const exact = normalizeKey(entry.term) === key ? 2 : 0;
        const contains = haystack.includes(key) ? 1 : 0;
        return { entry, relevance: exact + contains };
      })
      .filter((item) => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance || b.entry.confidence - a.entry.confidence)
      .slice(0, limit)
      .map((item) => item.entry);
  }

  static async searchDomain(domainId: string, query = "", limit = 25): Promise<LexiconEntry[]> {
    const results = await this.searchLexicon(query, { limit: 500 });
    const pool = query ? results : (await loadLexiconStore()).entries.filter((entry) => entry.status !== "rejected");
    return pool.filter((entry) => entry.domains.includes(domainId)).slice(0, limit);
  }

  static async searchCommunity(communityId: string, query = "", limit = 25): Promise<LexiconEntry[]> {
    const results = await this.searchLexicon(query, { limit: 500 });
    const pool = query ? results : (await loadLexiconStore()).entries.filter((entry) => entry.status !== "rejected");
    return pool.filter((entry) => entry.communities.includes(communityId)).slice(0, limit);
  }

  static async searchUserVocabulary(userId: string, query = "", limit = 25): Promise<LexiconEntry[]> {
    const ownerId = requireUserId(userId, "Lexicon user vocabulary search");
    const store = await loadLexiconStore();
    const key = normalizeKey(query);
    return store.entries
      .filter((entry) => entry.ownerScope === "user" && entry.ownerUserId === ownerId && entry.status !== "rejected")
      .filter((entry) => !key || normalizeKey(`${entry.term} ${entry.definition}`).includes(key))
      .sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt)))
      .slice(0, limit);
  }

  static async findRelatedTerms(
    termOrEntryId: string,
    context?: LexiconResolutionContext,
  ): Promise<Array<{ predicate: LexiconRelationship["predicate"]; direction: "outgoing" | "incoming"; entry: LexiconEntry }>> {
    const store = await loadLexiconStore();
    let seedIds: string[];
    const direct = store.entries.find((entry) => entry.id === termOrEntryId);
    if (direct) {
      seedIds = [direct.id];
    } else {
      const resolution = buildResolution(termOrEntryId, matchesForTerm(store, termOrEntryId, context));
      seedIds = [resolution.selected, ...resolution.alternates].filter((m): m is LexiconSenseMatch => Boolean(m)).map((m) => m.entry.id);
    }
    if (seedIds.length === 0) return [];

    const results: Array<{ predicate: LexiconRelationship["predicate"]; direction: "outgoing" | "incoming"; entry: LexiconEntry }> = [];
    for (const relationship of store.relationships) {
      if (seedIds.includes(relationship.fromEntryId)) {
        const entry = store.entries.find((item) => item.id === relationship.toEntryId);
        if (entry) results.push({ predicate: relationship.predicate, direction: "outgoing", entry });
      }
      if (seedIds.includes(relationship.toEntryId)) {
        const entry = store.entries.find((item) => item.id === relationship.fromEntryId);
        if (entry) results.push({ predicate: relationship.predicate, direction: "incoming", entry });
      }
    }
    return results;
  }

  static async registerCandidate(input: RegisterCandidateInput): Promise<LexiconEntry> {
    const term = normalizeSpace(input.term);
    if (!term) throw new Error("registerCandidate requires a term");
    const excerpt = normalizeSpace(input.evidenceExcerpt || "").slice(0, 480);
    if (!excerpt) throw new Error("registerCandidate requires evidenceExcerpt");

    const store = await loadLexiconStore();
    const key = normalizeKey(term);
    const ownerScope = input.ownerScope || (input.userId ? "user" : "global");
    const ownerUserId = ownerScope === "user" ? input.userId || null : null;

    const existing = store.entries.find(
      (entry) =>
        normalizeKey(entry.canonicalForm) === key &&
        entry.ownerScope === ownerScope &&
        entry.ownerUserId === ownerUserId &&
        (input.domain ? entry.domains.includes(input.domain) : true) &&
        entry.status !== "rejected",
    );

    const evidence = {
      id: stableId("ev", `${key}:${excerpt}:${Date.now()}`),
      excerpt,
      observedAt: nowIso(),
      sourceLabel: input.sourceLabel || "conversation",
      userId: input.userId || null,
      conversationId: input.conversationId || null,
    };

    if (existing) {
      const alreadyHasEvidence = existing.evidence.some((item) => item.excerpt === excerpt);
      existing.evidence = alreadyHasEvidence ? existing.evidence : [...existing.evidence, evidence].slice(-20);
      if (existing.status === "candidate" && !alreadyHasEvidence) {
        existing.confidence = Number(Math.min(0.95, existing.confidence + 0.08).toFixed(2));
      }
      existing.updatedAt = nowIso();
      existing.version += 1;
      await saveLexiconStore(store);
      return existing;
    }

    const now = nowIso();
    const entry: LexiconEntry = {
      id: stableId("lex", `${key}:${ownerScope}:${ownerUserId || "global"}:${Date.now()}`),
      term,
      canonicalForm: term.toLowerCase(),
      variants: [],
      pronunciation: null,
      definition: input.definitionGuess ? normalizeSpace(input.definitionGuess) : "",
      alternateDefinitions: [],
      contexts: [],
      domains: input.domain ? [input.domain] : ownerScope === "user" ? ["user_vocabulary"] : [],
      communities: input.community ? [input.community] : [],
      relatedTerms: [],
      parentConcepts: [],
      childConcepts: [],
      synonyms: [],
      antonyms: [],
      abbreviations: [],
      acronyms: [],
      exampleUsage: [],
      exampleSentences: [],
      confidence: 0.35,
      authority: input.authority || (input.userId ? "user_defined" : "external_reference"),
      evidence: [evidence],
      source: input.sourceLabel || "conversation",
      firstObserved: now,
      lastConfirmed: null,
      version: 1,
      status: "candidate",
      deprecation: { deprecated: false, reason: null, supersededBy: null },
      sensitivityFlags: [],
      notes: "",
      ownerScope,
      ownerUserId,
      createdAt: now,
      updatedAt: now,
    };
    store.entries.push(entry);
    await saveLexiconStore(store);
    return entry;
  }

  static async confirmMeaning(entryId: string, reviewer: string, definition?: string): Promise<LexiconEntry> {
    const store = await loadLexiconStore();
    const entry = store.entries.find((item) => item.id === entryId);
    if (!entry) throw new Error("Lexicon entry not found");
    entry.status = "verified";
    entry.lastConfirmed = nowIso();
    entry.updatedAt = nowIso();
    entry.version += 1;
    if (entry.authority === "user_defined") entry.authority = "verified_user";
    if (definition) entry.definition = normalizeSpace(definition);
    entry.notes = normalizeSpace(`${entry.notes}\nConfirmed by ${reviewer} on ${entry.lastConfirmed}.`);
    await saveLexiconStore(store);
    return entry;
  }

  static async rejectMeaning(entryId: string, reviewer: string, reason?: string): Promise<LexiconEntry> {
    const store = await loadLexiconStore();
    const entry = store.entries.find((item) => item.id === entryId);
    if (!entry) throw new Error("Lexicon entry not found");
    entry.status = "rejected";
    entry.updatedAt = nowIso();
    entry.version += 1;
    entry.notes = normalizeSpace(`${entry.notes}\nRejected by ${reviewer}${reason ? `: ${reason}` : ""}.`);
    await saveLexiconStore(store);
    return entry;
  }

  static async deprecateEntry(entryId: string, reviewer: string, reason?: string, supersededBy?: string): Promise<LexiconEntry> {
    const store = await loadLexiconStore();
    const entry = store.entries.find((item) => item.id === entryId);
    if (!entry) throw new Error("Lexicon entry not found");
    entry.status = "deprecated";
    entry.deprecation = { deprecated: true, reason: reason || null, supersededBy: supersededBy || null };
    entry.updatedAt = nowIso();
    entry.version += 1;
    entry.notes = normalizeSpace(`${entry.notes}\nDeprecated by ${reviewer}${reason ? `: ${reason}` : ""}.`);
    await saveLexiconStore(store);
    return entry;
  }

  static async mergeEntries(sourceId: string, targetId: string, reviewer: string): Promise<{ source: LexiconEntry; target: LexiconEntry }> {
    if (sourceId === targetId) throw new Error("Cannot merge an entry into itself");
    const store = await loadLexiconStore();
    const source = store.entries.find((item) => item.id === sourceId);
    const target = store.entries.find((item) => item.id === targetId);
    if (!source || !target) throw new Error("Both entries must exist to merge");

    const dedupe = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
    target.variants = dedupe([...target.variants, ...source.variants, source.term]);
    target.synonyms = dedupe([...target.synonyms, ...source.synonyms]);
    target.antonyms = dedupe([...target.antonyms, ...source.antonyms]);
    target.abbreviations = dedupe([...target.abbreviations, ...source.abbreviations]);
    target.acronyms = dedupe([...target.acronyms, ...source.acronyms]);
    target.domains = dedupe([...target.domains, ...source.domains]);
    target.communities = dedupe([...target.communities, ...source.communities]);
    target.relatedTerms = dedupe([...target.relatedTerms, ...source.relatedTerms]);
    target.exampleUsage = dedupe([...target.exampleUsage, ...source.exampleUsage]);
    target.exampleSentences = dedupe([...target.exampleSentences, ...source.exampleSentences]);
    if (source.definition && source.definition !== target.definition) {
      target.alternateDefinitions = dedupe([...target.alternateDefinitions, source.definition]);
    }
    target.evidence = [...target.evidence, ...source.evidence].slice(-30);
    target.confidence = Number(Math.max(target.confidence, source.confidence).toFixed(2));
    target.updatedAt = nowIso();
    target.version += 1;

    source.status = "deprecated";
    source.deprecation = { deprecated: true, reason: "merged", supersededBy: target.id };
    source.updatedAt = nowIso();
    source.version += 1;
    source.notes = normalizeSpace(`${source.notes}\nMerged into ${target.id} by ${reviewer}.`);

    const seen = new Set<string>();
    store.relationships = store.relationships
      .map((relationship) => ({
        ...relationship,
        fromEntryId: relationship.fromEntryId === sourceId ? targetId : relationship.fromEntryId,
        toEntryId: relationship.toEntryId === sourceId ? targetId : relationship.toEntryId,
      }))
      .filter((relationship) => {
        if (relationship.fromEntryId === relationship.toEntryId) return false;
        const dedupeKey = `${relationship.fromEntryId}:${relationship.predicate}:${relationship.toEntryId}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });

    await saveLexiconStore(store);
    return { source, target };
  }

  /**
   * Pipeline-facing bulk resolution. Scans text for known lexicon
   * terms/phrases (longest match wins), returns a compact "interpreted
   * meaning" block for the reasoning prompt plus any unresolved
   * quote/definition-style signals a caller may want to register as
   * candidates. Deterministic and read-only — it does not itself write
   * candidates, matching the rest of the Cognitive Core's engines.
   */
  static async resolveText(text: string, context?: LexiconResolutionContext): Promise<LexiconTextResolution> {
    const store = await loadLexiconStore();
    const clean = normalizeSpace(text);
    if (!clean) return { prompt: "", resolutions: [], unresolvedSignals: [] };

    const words = clean.split(/\s+/).filter(Boolean);
    const mergedContext: LexiconResolutionContext = { ...context, conversationText: clean };

    type Span = { start: number; end: number; matches: LexiconSenseMatch[]; surface: string };
    const spans: Span[] = [];
    for (let size = Math.min(MAX_NGRAM, words.length); size >= 1; size -= 1) {
      for (let start = 0; start + size <= words.length; start += 1) {
        const surface = words.slice(start, start + size).join(" ").replace(/[^\w\s'-]/g, "");
        if (!surface) continue;
        const matches = matchesForTerm(store, surface, mergedContext);
        if (matches.length > 0) spans.push({ start, end: start + size, matches, surface });
      }
    }

    spans.sort((a, b) => b.end - b.start - (a.end - a.start) || b.matches[0].score - a.matches[0].score);
    const claimed = new Array<boolean>(words.length).fill(false);
    const resolutions: LexiconResolution[] = [];
    for (const span of spans) {
      if (resolutions.length >= MAX_TEXT_RESOLUTIONS) break;
      let overlaps = false;
      for (let index = span.start; index < span.end; index += 1) {
        if (claimed[index]) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      for (let index = span.start; index < span.end; index += 1) claimed[index] = true;
      resolutions.push(buildResolution(span.surface, span.matches));
    }

    const prompt = resolutions.length
      ? [
          "## Lexicon Authority — Interpreted Meaning",
          "Understand these terms in context before reasoning; if a term is ambiguous, weigh the alternates against the user's domain/community context rather than defaulting to the first sense.",
          ...resolutions.map((resolution) => {
            const selected = resolution.selected as LexiconSenseMatch;
            const alternates = resolution.alternates.length
              ? ` | alternates: ${resolution.alternates.map((alt) => describeSense(alt)).join("; ")}`
              : "";
            const flag = resolution.status === "ambiguous" ? " (ambiguous — multiple community meanings)" : "";
            return `- ${describeSense(selected)}${flag}${alternates}`;
          }),
        ].join("\n")
      : "";

    const unresolvedSignals = extractUnresolvedSignals(clean)
      .filter((candidate) => !resolutions.some((resolution) => normalizeKey(resolution.term) === normalizeKey(candidate)))
      .filter((candidate) => matchesForTerm(store, candidate, mergedContext).length === 0)
      .slice(0, MAX_UNRESOLVED_SIGNALS);

    return { prompt, resolutions, unresolvedSignals };
  }
}
