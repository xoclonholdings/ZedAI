import type { LexiconAuthoritySource, LexiconEntry, LexiconRelationship, LexiconRelationshipPredicate } from "./types";
import { nowIso, stableId } from "./util";

/**
 * Seed data — a small, deliberately varied starting lexicon that
 * demonstrates the architecture end to end: one term with several
 * unrelated meanings (bridge, swap, clock), community language
 * preserved as distinct entries rather than flattened into standard
 * English (mother / muva / motha), and internal ZAR-family
 * terminology. This is a starting point, not a bounded universe —
 * the lexicon is meant to grow through the discovery pipeline.
 */

let counter = 0;
function entryId(term: string): string {
  counter += 1;
  return stableId("lex", `${term}:${counter}`);
}

function makeEntry(input: {
  term: string;
  definition: string;
  domains: string[];
  communities?: string[];
  authority: LexiconAuthoritySource;
  confidence: number;
  synonyms?: string[];
  antonyms?: string[];
  variants?: string[];
  exampleUsage?: string[];
  notes?: string;
  sensitivityFlags?: string[];
}): LexiconEntry {
  const now = nowIso();
  return {
    id: entryId(input.term),
    term: input.term,
    canonicalForm: input.term.toLowerCase(),
    variants: input.variants || [],
    pronunciation: null,
    definition: input.definition,
    alternateDefinitions: [],
    contexts: [],
    domains: input.domains,
    communities: input.communities || [],
    relatedTerms: [],
    parentConcepts: [],
    childConcepts: [],
    synonyms: input.synonyms || [],
    antonyms: input.antonyms || [],
    abbreviations: [],
    acronyms: [],
    exampleUsage: input.exampleUsage || [],
    exampleSentences: [],
    confidence: input.confidence,
    authority: input.authority,
    evidence: [
      {
        id: stableId("ev", `${input.term}:${input.authority}:seed`),
        excerpt: input.definition,
        observedAt: now,
        sourceLabel: "Lexicon Authority seed manifest",
      },
    ],
    source: "Lexicon Authority seed manifest",
    firstObserved: now,
    lastConfirmed: now,
    version: 1,
    status: "verified",
    deprecation: { deprecated: false, reason: null, supersededBy: null },
    sensitivityFlags: input.sensitivityFlags || [],
    notes: input.notes || "",
    ownerScope: "global",
    ownerUserId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildSeedLexicon(): { entries: LexiconEntry[]; relationships: LexiconRelationship[] } {
  counter = 0;
  const entries: LexiconEntry[] = [];
  const byKey = new Map<string, LexiconEntry>();
  const add = (entry: LexiconEntry, key: string) => {
    entries.push(entry);
    byKey.set(key, entry);
    return entry;
  };

  add(
    makeEntry({
      term: "bridge",
      definition: "A structure spanning a gap so people or vehicles can cross it.",
      domains: ["general_english"],
      authority: "standard_dictionary",
      confidence: 1,
    }),
    "bridge:architecture",
  );
  add(
    makeEntry({
      term: "bridge",
      definition: "A contrasting section of a song that connects two other sections, usually before the final chorus.",
      domains: ["music"],
      authority: "standard_dictionary",
      confidence: 0.95,
    }),
    "bridge:music",
  );
  add(
    makeEntry({
      term: "bridge",
      definition: "Software or hardware that connects two otherwise separate networks or systems so they can interoperate.",
      domains: ["programming", "technology"],
      authority: "programming",
      confidence: 0.95,
    }),
    "bridge:tech",
  );

  add(
    makeEntry({
      term: "swap",
      definition: "Disk-backed virtual memory a system uses as an overflow for RAM.",
      domains: ["programming", "technology"],
      authority: "programming",
      confidence: 0.95,
    }),
    "swap:memory",
  );
  add(
    makeEntry({
      term: "swap",
      definition: "A derivative contract in which two parties exchange cash flows or financial instruments.",
      domains: ["finance", "trading"],
      authority: "financial",
      confidence: 0.95,
    }),
    "swap:finance",
  );
  add(
    makeEntry({
      term: "swap",
      definition: "An on-chain exchange of one token for another, typically through an automated market maker.",
      domains: ["cryptocurrency", "web3"],
      authority: "external_reference",
      confidence: 0.9,
      synonyms: ["token swap"],
    }),
    "swap:web3",
  );
  add(
    makeEntry({
      term: "ZWAP",
      definition: "ZAR's internal product/venture for peer-to-peer value exchange and marketplace mechanics.",
      domains: ["zwap", "zar"],
      authority: "zwap_internal",
      confidence: 0.85,
      notes: "Internal terminology — see hub project memory for the current ZWAP plan.",
    }),
    "zwap:product",
  );

  add(
    makeEntry({
      term: "clock",
      definition: "A device or instrument that measures and displays time.",
      domains: ["general_english"],
      authority: "standard_dictionary",
      confidence: 1,
    }),
    "clock:device",
  );
  add(
    makeEntry({
      term: "clock",
      definition: "To recognize or figure someone out, especially something they were trying to conceal.",
      domains: ["internet_culture", "black_vernacular"],
      communities: ["internet_culture", "black_vernacular"],
      authority: "black_vernacular",
      confidence: 0.85,
      exampleUsage: ["I clocked that wig from the door."],
    }),
    "clock:read",
  );

  add(
    makeEntry({
      term: "read",
      definition: "To look at and comprehend written or printed matter.",
      domains: ["general_english"],
      authority: "standard_dictionary",
      confidence: 1,
    }),
    "read:standard",
  );
  const readBallroom = add(
    makeEntry({
      term: "read",
      definition: "To cleverly and pointedly call out someone's flaws, usually as a display of wit rather than genuine hostility.",
      domains: ["ballroom_culture", "lgbtq_terminology"],
      communities: ["ballroom_culture"],
      authority: "ballroom_community",
      confidence: 0.9,
      exampleUsage: ["Reading is fundamental."],
      notes: "Popularized by Paris Is Burning; a core Ballroom communication form, not an insult in the standard-English sense.",
    }),
    "read:ballroom",
  );

  add(
    makeEntry({
      term: "serve",
      definition: "To present food or drink to someone, or to assist a customer.",
      domains: ["general_english"],
      authority: "standard_dictionary",
      confidence: 1,
    }),
    "serve:standard",
  );
  add(
    makeEntry({
      term: "serve",
      definition: "To present a look, performance, or category execution with confidence and skill.",
      domains: ["ballroom_culture", "lgbtq_terminology"],
      communities: ["ballroom_culture"],
      authority: "ballroom_community",
      confidence: 0.85,
      exampleUsage: ["She served executive realness."],
    }),
    "serve:ballroom",
  );

  const motherStandard = add(
    makeEntry({
      term: "mother",
      definition: "A woman in relation to her child.",
      domains: ["general_english"],
      authority: "standard_dictionary",
      confidence: 1,
    }),
    "mother:standard",
  );
  const motherBallroom = add(
    makeEntry({
      term: "mother",
      definition: "The leader of a House who mentors, protects, and represents its members in the Ballroom scene.",
      domains: ["ballroom_culture", "lgbtq_terminology"],
      communities: ["ballroom_culture"],
      authority: "ballroom_community",
      confidence: 0.9,
      variants: ["housemother"],
    }),
    "mother:ballroom",
  );
  const muva = add(
    makeEntry({
      term: "Muva",
      definition: "A House Mother's title, used as a distinct term of address within Ballroom/Black queer community rather than a synonym to be flattened into 'mother.'",
      domains: ["ballroom_culture", "black_vernacular", "lgbtq_terminology"],
      communities: ["ballroom_culture", "black_vernacular"],
      authority: "black_vernacular",
      confidence: 0.85,
    }),
    "mother:muva",
  );
  const motha = add(
    makeEntry({
      term: "Motha",
      definition: "A regional/community spelling variant used as a House Mother's title alongside Muva and Mother.",
      domains: ["ballroom_culture", "black_vernacular", "lgbtq_terminology"],
      communities: ["ballroom_culture", "black_vernacular"],
      authority: "black_vernacular",
      confidence: 0.75,
    }),
    "mother:motha",
  );

  add(
    makeEntry({
      term: "house",
      definition: "A building for human habitation.",
      domains: ["general_english"],
      authority: "standard_dictionary",
      confidence: 1,
    }),
    "house:standard",
  );
  const houseBallroom = add(
    makeEntry({
      term: "house",
      definition: "A chosen family and competitive team within the Ballroom scene, led by a Mother and/or Father.",
      domains: ["ballroom_culture", "lgbtq_terminology"],
      communities: ["ballroom_culture"],
      authority: "ballroom_community",
      confidence: 0.9,
    }),
    "house:ballroom",
  );

  add(
    makeEntry({
      term: "shade",
      definition: "Shelter from direct sunlight.",
      domains: ["general_english"],
      authority: "standard_dictionary",
      confidence: 1,
    }),
    "shade:standard",
  );
  add(
    makeEntry({
      term: "shade",
      definition: "A subtle, indirect insult delivered with style rather than stated outright.",
      domains: ["ballroom_culture", "internet_culture", "lgbtq_terminology"],
      communities: ["ballroom_culture", "internet_culture"],
      authority: "ballroom_community",
      confidence: 0.85,
      exampleUsage: ["Throwing shade."],
    }),
    "shade:ballroom",
  );

  add(
    makeEntry({
      term: "ate",
      definition: "Past tense of eat.",
      domains: ["general_english"],
      authority: "standard_dictionary",
      confidence: 1,
    }),
    "ate:standard",
  );
  add(
    makeEntry({
      term: "ate",
      definition: "Performed exceptionally well, leaving nothing to critique.",
      domains: ["internet_culture", "black_vernacular"],
      communities: ["internet_culture", "black_vernacular"],
      authority: "internet_culture",
      confidence: 0.8,
      exampleUsage: ["She ate and left no crumbs."],
    }),
    "ate:slang",
  );

  add(
    makeEntry({
      term: "icon",
      definition: "A widely recognized and revered symbol, sign, or figure.",
      domains: ["general_english"],
      authority: "standard_dictionary",
      confidence: 1,
    }),
    "icon:standard",
  );
  add(
    makeEntry({
      term: "icon",
      definition: "A Ballroom title given to a legendary competitor who has earned lasting community recognition.",
      domains: ["ballroom_culture", "lgbtq_terminology"],
      communities: ["ballroom_culture"],
      authority: "ballroom_community",
      confidence: 0.85,
    }),
    "icon:ballroom",
  );

  add(
    makeEntry({
      term: "ZCOS",
      definition: "ZAR's internal cognitive operating system — the runtime layer the Cognitive Core and Intelligence Core are migrating toward.",
      domains: ["zcos", "zar"],
      authority: "zcos_internal",
      confidence: 0.85,
    }),
    "zcos:product",
  );
  add(
    makeEntry({
      term: "Z-Citi",
      definition: "A ZAR-family venture in the ZAR product ecosystem.",
      domains: ["z_citi", "zar"],
      authority: "z_citi_internal",
      confidence: 0.6,
      notes: "Low-confidence placeholder pending confirmed evidence — a candidate for review, not a settled definition.",
    }),
    "z_citi:product",
  );

  const relationships: LexiconRelationship[] = [];
  const relate = (
    fromKey: string,
    predicate: LexiconRelationshipPredicate,
    toKey: string,
    confidence = 0.85,
  ) => {
    const from = byKey.get(fromKey);
    const to = byKey.get(toKey);
    if (!from || !to) return;
    relationships.push({
      id: stableId("lexrel", `${from.id}:${predicate}:${to.id}`),
      fromEntryId: from.id,
      predicate,
      toEntryId: to.id,
      confidence,
      evidence: null,
      createdAt: nowIso(),
    });
  };

  relate("mother:ballroom", "community_variant_of", "mother:standard", 0.6);
  relate("mother:muva", "community_variant_of", "mother:ballroom", 0.9);
  relate("mother:motha", "community_variant_of", "mother:ballroom", 0.85);
  relate("mother:muva", "related_to", "mother:motha", 0.8);
  relate("house:ballroom", "community_variant_of", "house:standard", 0.5);
  relate("mother:ballroom", "part_of", "house:ballroom", 0.85);
  relate("read:ballroom", "related_to", "shade:ballroom", 0.6);
  relate("clock:read", "related_to", "read:ballroom", 0.5);
  relate("swap:web3", "derived_from", "swap:finance", 0.6);
  relate("swap:memory", "related_to", "swap:finance", 0.3);
  relate("zwap:product", "related_to", "swap:web3", 0.5);
  relate("zcos:product", "related_to", "zwap:product", 0.4);

  void motherStandard;
  void motherBallroom;
  void muva;
  void motha;
  void houseBallroom;
  void readBallroom;

  return { entries, relationships };
}
