/**
 * Lexicon Authority — the semantic interpretation layer of the
 * Knowledge Authority. It understands words, phrases, abbreviations,
 * acronyms, slang, community language, and user-defined vocabulary
 * before reasoning begins. See docs/policies/LEXICON_AUTHORITY.md and
 * SPEC.md § Lexicon Authority.
 */

export const LEXICON_AUTHORITIES = [
  "standard_dictionary",
  "scientific",
  "legal",
  "medical",
  "financial",
  "programming",
  "ballroom_community",
  "black_vernacular",
  "lgbtq_terminology",
  "internet_culture",
  "zar_internal",
  "zwap_internal",
  "zcos_internal",
  "z_citi_internal",
  "user_defined",
  "verified_user",
  "external_reference",
] as const;

export type LexiconAuthoritySource = (typeof LEXICON_AUTHORITIES)[number];

export const LEXICON_ENTRY_STATUSES = [
  "candidate",
  "verified",
  "deprecated",
  "rejected",
] as const;

export type LexiconEntryStatus = (typeof LEXICON_ENTRY_STATUSES)[number];

export const LEXICON_RELATIONSHIP_PREDICATES = [
  "is_a",
  "part_of",
  "related_to",
  "derived_from",
  "variant_of",
  "abbreviation_of",
  "synonym_of",
  "antonym_of",
  "community_variant_of",
  "historical_form_of",
  "successor_of",
  "predecessor_of",
] as const;

export type LexiconRelationshipPredicate = (typeof LEXICON_RELATIONSHIP_PREDICATES)[number];

/** A domain is a namespace of terminology (finance, ballroom, ZWAP, ...).
 *  The default set ships in hub/config/lexicon-domains.yaml and is
 *  extensible without a code change — see domains.ts. */
export interface LexiconDomain {
  id: string;
  label: string;
  description: string;
  community: boolean;
}

export interface LexiconEvidence {
  id: string;
  excerpt: string;
  observedAt: string;
  sourceLabel: string;
  userId?: string | null;
  conversationId?: string | null;
}

/** One entry represents ONE meaning of a term. A word with several
 *  meanings (bridge, mother, read, swap, ...) is several entries that
 *  share a term and are linked by relationships (e.g. two entries for
 *  "mother" — parental vs. ballroom-house-mother — are `related_to`,
 *  never merged into one flattened definition). */
export interface LexiconEntry {
  id: string;
  term: string;
  canonicalForm: string;
  variants: string[];
  pronunciation: string | null;
  definition: string;
  alternateDefinitions: string[];
  contexts: string[];
  domains: string[];
  communities: string[];
  relatedTerms: string[];
  parentConcepts: string[];
  childConcepts: string[];
  synonyms: string[];
  antonyms: string[];
  abbreviations: string[];
  acronyms: string[];
  exampleUsage: string[];
  exampleSentences: string[];
  confidence: number;
  authority: LexiconAuthoritySource;
  evidence: LexiconEvidence[];
  source: string;
  firstObserved: string;
  lastConfirmed: string | null;
  version: number;
  status: LexiconEntryStatus;
  deprecation: { deprecated: boolean; reason: string | null; supersededBy: string | null };
  sensitivityFlags: string[];
  notes: string;
  /** "global" entries are shared authority; "user" entries belong to
   *  exactly one user's personal vocabulary and are never promoted to
   *  global without an explicit confirmMeaning call. */
  ownerScope: "global" | "user";
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LexiconRelationship {
  id: string;
  fromEntryId: string;
  predicate: LexiconRelationshipPredicate;
  toEntryId: string;
  confidence: number;
  evidence: string | null;
  createdAt: string;
}

export interface LexiconResolutionContext {
  userId?: string;
  domain?: string;
  community?: string;
  conversationText?: string;
  workspaceId?: string;
}

export interface LexiconSenseMatch {
  entry: LexiconEntry;
  score: number;
  matchedOn: "term" | "canonicalForm" | "variant" | "abbreviation" | "acronym" | "synonym";
}

export interface LexiconResolution {
  term: string;
  found: boolean;
  selected: LexiconSenseMatch | null;
  alternates: LexiconSenseMatch[];
  status: "resolved" | "ambiguous" | "unknown";
}

export interface LexiconPhraseResolution extends LexiconResolution {
  phrase: string;
}

export interface LexiconTextResolution {
  prompt: string;
  resolutions: LexiconResolution[];
  unresolvedSignals: string[];
}

export interface RegisterCandidateInput {
  term: string;
  definitionGuess?: string;
  domain?: string;
  community?: string;
  authority?: LexiconAuthoritySource;
  evidenceExcerpt: string;
  sourceLabel: string;
  userId?: string;
  conversationId?: string;
  ownerScope?: "global" | "user";
}
