# Lexicon Authority

## Objective

The Lexicon Authority is the semantic interpretation layer of the Knowledge Authority. It understands words, phrases, symbols, slang, technical terminology, cultural language, and user-specific vocabulary before reasoning begins.

It is not a spell checker. It is not a thesaurus. It is not a flat dictionary. It is the layer that decides which meaning of a word applies, given domain, culture, profession, community, project, relationship, history, and user intent.

## Core Philosophy

Words do not have one meaning. They have context.

Meaning depends on language, culture, profession, domain, community, project, relationship, and history. The Lexicon exists to determine which meaning is correct for a given moment, not to collapse every meaning into one canonical definition. Understanding must happen before reasoning.

## Position In The Knowledge Authority

The Lexicon Authority is a core subsystem of Knowledge, a sibling to the Knowledge Graph, Sources, Library, Collections, Concepts, Relationships, References, and Discovery, not a dependency of any one of them:

```text
Knowledge
├── Knowledge Graph
├── Sources
├── Library
├── Collections
├── Concepts
├── Relationships
├── References
├── Discovery
└── Lexicon Authority
```

Although owned by Knowledge, every subsystem may query it: Memory, Identity, Projects, Workspaces, Finance, Trading, Marketing, ZWAP, Z-Citi, and future applications. It is a single shared authority — terminology is never duplicated per workspace.

## Runtime Implementation

- Service: `server/services/lexicon-authority/LexiconAuthorityService.ts`
- Types: `server/services/lexicon-authority/types.ts`
- Storage: `server/services/lexicon-authority/store.ts` (`hub/shared-memory/lexicon/lexicon.json` — local fallback/export storage, same non-canonical status as `hub/shared-memory/knowledge-graph/`)
- Domain manifest: `hub/config/lexicon-domains.yaml`, loaded by `server/services/lexicon-authority/domains.ts`
- Seed lexicon: `server/services/lexicon-authority/seed.ts`
- Routes: `server/routes-modules/lexicon.ts` (`/api/lexicon/*`)
- Cognitive Core wiring: `server/services/ChatExecutionService.ts`
- Admin UI: `client/src/components/admin/sections/knowledge/LexiconView.tsx`

See `SPEC.md` § Lexicon Authority for the current route list and Cognitive Core ordering.

## Responsibilities

The Lexicon Authority interprets words, phrases, abbreviations, acronyms, emojis and symbols, slang, internet language, cultural and community-specific language, technical and project terminology, and user-defined terminology. It tracks how language evolves, maintains relationships between concepts, and supports multiple meanings, multiple contexts, and multiple authorities for the same term at once.

## Domains

Terminology is organized into independent, extensible domains rather than one flat wordlist. The default set — general English, business, finance, law, medicine, technology, programming, AI, cybersecurity, music, film, gaming, fitness, trading, cryptocurrency, web3, marketing, education, psychology, government, science, religion, mathematics, history, culture, regional language, internet culture, Ballroom culture, Black Vernacular, LGBTQ+ terminology, ZAR, ZWAP, ZCOS, Z-Citi, and user vocabulary — ships in `hub/config/lexicon-domains.yaml`. Adding a domain there makes it usable immediately, with no code change.

## Entry Model

Each Lexicon Entry represents **one meaning** of a term, not the term itself. A word with several unrelated or community-specific meanings — bridge, swap, clock, mother, read, serve, shade, house, icon, ate — is several entries sharing a term string, linked to each other by relationships rather than flattened into a single definition.

An entry carries: term, canonical form, variants, pronunciation (optional), definition, alternate definitions, contexts, domains, communities, related/parent/child concepts, synonyms, antonyms, abbreviations, acronyms, example usage, example sentences, confidence, authority, evidence, source, first-observed and last-confirmed timestamps, version, status, deprecation record, sensitivity flags, and notes.

## Authorities

Every meaning identifies where it came from. No definition is assumed globally correct. Recognized authorities: Standard Dictionary, Scientific, Legal, Medical, Financial, Programming, Ballroom Community, Black Vernacular, LGBTQ+ Terminology, Internet Culture, ZAR Internal, ZWAP Internal, ZCOS Internal, Z-Citi Internal, User Defined, Verified User, External Reference.

Confirming a `User Defined` candidate through `confirmMeaning` upgrades it to `Verified User` — the system distinguishes "a user said this" from "this was reviewed and confirmed."

## Multiple Meanings

The same word may have many meanings — bridge, memory, swap, mother, house, serve, clock, read, trade, body, icon, shade, ate, work. Which one applies is decided from the active domain, community, and conversation context at resolution time, not fixed in advance. When two meanings are close in confidence, the Lexicon reports the ambiguity explicitly (`status: "ambiguous"` with ranked alternates) rather than silently picking one.

## Community Language

Community terminology — Ballroom, drag, gaming, anime, sports, military, medical, legal, regional dialects, internet communities — is preserved as its own entry, never flattened into standard English. Mother, Muva, and Motha are three linked entries (`community_variant_of`, `related_to`), not one entry with the others discarded as synonyms. Original wording is preserved; cultural language is never silently overwritten.

## User Vocabulary

The Lexicon continuously learns. When a user's terminology doesn't match anything known, `registerCandidate` creates a low-confidence candidate scoped to that user (`ownerScope: "user"`), collects evidence on repeated occurrences, and raises confidence — but it is never permanently learned from one occurrence, and it is never silently promoted into the shared/global lexicon. Promotion to `verified` always goes through an explicit `confirmMeaning` call.

## Semantic Relationships

The Lexicon is a graph of entries connected by typed predicates: `is_a`, `part_of`, `related_to`, `derived_from`, `variant_of`, `abbreviation_of`, `synonym_of`, `antonym_of`, `community_variant_of`, `historical_form_of`, `successor_of`, `predecessor_of`. These reuse the Knowledge Graph's subject/predicate/object shape and predicate vocabulary so the two subsystems agree on what a relationship is, without merging into one graph engine or one store — a later pass can unify storage without a schema change.

## Reasoning Pipeline

Lexicon Authority resolution runs first in the Cognitive Core, ahead of Context Inquiry:

```text
User Input
  -> Lexicon Authority
  -> Intent Interpretation (Context Inquiry)
  -> Knowledge Assembly
  -> Reasoning
  -> Response
```

`LexiconAuthorityService.resolveText` is deterministic and read-only: it scans the message for known terms and phrases (longest match wins), returns a compact "Interpreted Meaning" block for the reasoning prompt, and separately surfaces unresolved quote/definition-style signals ("what does X mean", "define X", quoted terms) for the caller to register as candidates. It never writes as a side effect of reading.

## Discovery

Unknown terms follow a governed workflow, not silent inference:

```text
Unknown Term
  -> Search Existing Lexicon
  -> Search Domain Lexicons
  -> Search User Vocabulary
  -> Evaluate Confidence
  -> Create Candidate Entry (registerCandidate)
  -> Collect Evidence
  -> Review (confirmMeaning / rejectMeaning)
  -> Promote to Verified
```

No term is permanently learned from one occurrence — repeated evidence raises confidence, but only an explicit review action changes status.

## UI

The Knowledge admin section includes a Lexicon view (`Knowledge -> Lexicon`) with search across the shared lexicon, domain filter chips, and a discovered-terms review queue where an admin can confirm or reject candidates. The UI only talks to the typed API surface below — it never reaches into the store directly.

## API

Typed service methods, mirrored 1:1 as `/api/lexicon/*` routes: `resolveTerm`, `resolvePhrase`, `resolveMeaning`, `suggestMeaning`, `searchLexicon`, `searchDomain`, `searchCommunity`, `searchUserVocabulary`, `registerCandidate`, `confirmMeaning`, `rejectMeaning`, `mergeEntries`, `deprecateEntry`, `listDomains`, `listAuthorities`, `findRelatedTerms`.

## Integration

The Lexicon Authority reuses existing infrastructure rather than duplicating it: it is a sibling under the Knowledge Authority (not a new top-level system), its storage follows the same local-fallback pattern as the Knowledge Graph, and its relationships share the Knowledge Graph's predicate vocabulary. It does not introduce a second graph engine or a second storage layer.

## Success Criteria

ZAR reasons over interpreted meaning rather than raw language — informed by domain, culture, community, context, user history, evidence, authority, and relationships. The lexicon grows through the discovery pipeline as an extensible, evidence-gated system rather than a fixed, bounded dictionary.

## Implementation Notes

- Prefer refinement (`registerCandidate` strengthening an existing entry, `mergeEntries` folding a duplicate sense into its canonical entry) over creating a new entry when an existing one already captures the meaning.
- Deprecating or merging an entry never deletes it — `deprecation.supersededBy` and `alternateDefinitions` preserve the lineage.
- Resolution scoring and discovery are deterministic (no model call), consistent with the rest of the Cognitive Core's engines (Context Inquiry, Deep Thinking, Context Intelligence).
