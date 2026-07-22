import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

import { HUB_CONFIG_DIR } from "../../utils/repoPaths";
import type { LexiconDomain } from "./types";

const DOMAINS_YAML = path.join(HUB_CONFIG_DIR, "lexicon-domains.yaml");

/** Ships as the fallback when hub/config/lexicon-domains.yaml is
 *  missing or fails to parse — the manifest file is the extension
 *  point for adding domains without a code change. */
const DEFAULT_DOMAINS: LexiconDomain[] = [
  { id: "general_english", label: "General English", description: "Everyday standard English usage.", community: false },
  { id: "business", label: "Business", description: "Business and operations terminology.", community: false },
  { id: "finance", label: "Finance", description: "Finance and accounting terminology.", community: false },
  { id: "law", label: "Law", description: "Legal terminology.", community: false },
  { id: "medicine", label: "Medicine", description: "Medical and clinical terminology.", community: false },
  { id: "technology", label: "Technology", description: "General technology terminology.", community: false },
  { id: "programming", label: "Programming", description: "Software engineering terminology.", community: false },
  { id: "artificial_intelligence", label: "Artificial Intelligence", description: "AI and machine learning terminology.", community: false },
  { id: "cybersecurity", label: "Cybersecurity", description: "Security terminology.", community: false },
  { id: "music", label: "Music", description: "Music terminology.", community: false },
  { id: "film", label: "Film", description: "Film and television terminology.", community: false },
  { id: "gaming", label: "Gaming", description: "Video game terminology.", community: false },
  { id: "fitness", label: "Fitness", description: "Fitness and training terminology.", community: false },
  { id: "trading", label: "Trading", description: "Market and trading terminology.", community: false },
  { id: "cryptocurrency", label: "Cryptocurrency", description: "Crypto terminology.", community: false },
  { id: "web3", label: "Web3", description: "Web3 and decentralized-app terminology.", community: false },
  { id: "marketing", label: "Marketing", description: "Marketing and growth terminology.", community: false },
  { id: "education", label: "Education", description: "Education terminology.", community: false },
  { id: "psychology", label: "Psychology", description: "Psychology terminology.", community: false },
  { id: "government", label: "Government", description: "Government and civic terminology.", community: false },
  { id: "science", label: "Science", description: "General scientific terminology.", community: false },
  { id: "religion", label: "Religion", description: "Religious terminology.", community: false },
  { id: "mathematics", label: "Mathematics", description: "Mathematical terminology.", community: false },
  { id: "history", label: "History", description: "Historical terminology.", community: false },
  { id: "culture", label: "Culture", description: "General cultural terminology.", community: true },
  { id: "regional_language", label: "Regional Language", description: "Regional and dialectal language.", community: true },
  { id: "internet_culture", label: "Internet Culture", description: "Internet-native slang and idiom.", community: true },
  { id: "ballroom_culture", label: "Ballroom Culture", description: "Ballroom and drag-scene terminology.", community: true },
  { id: "black_vernacular", label: "Black Vernacular", description: "African American Vernacular English.", community: true },
  { id: "lgbtq_terminology", label: "LGBTQ+ Terminology", description: "LGBTQ+ community terminology.", community: true },
  { id: "zar", label: "ZAR", description: "ZAR-internal terminology.", community: false },
  { id: "zwap", label: "ZWAP", description: "ZWAP-internal terminology.", community: false },
  { id: "zcos", label: "ZCOS", description: "ZCOS-internal terminology.", community: false },
  { id: "z_citi", label: "Z-Citi", description: "Z-Citi-internal terminology.", community: false },
  { id: "user_vocabulary", label: "User Vocabulary", description: "Terminology unique to one user, not yet shared.", community: false },
];

let cache: LexiconDomain[] | null = null;

function normalizeEntry(raw: any): LexiconDomain | null {
  if (!raw || typeof raw.id !== "string" || !raw.id.trim()) return null;
  return {
    id: raw.id.trim(),
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : raw.id.trim(),
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    community: raw.community === true,
  };
}

export async function loadLexiconDomains(): Promise<LexiconDomain[]> {
  if (cache) return cache;
  try {
    const raw = yaml.load(await fs.readFile(DOMAINS_YAML, "utf-8"));
    const list = Array.isArray((raw as any)?.domains) ? (raw as any).domains : [];
    const parsed = list.map(normalizeEntry).filter((entry: LexiconDomain | null): entry is LexiconDomain => entry !== null);
    cache = parsed.length > 0 ? parsed : DEFAULT_DOMAINS;
  } catch {
    cache = DEFAULT_DOMAINS;
  }
  return cache;
}

/** Test/ops hook — the ruleset editor pattern used elsewhere in the
 *  codebase invalidates a cache like this after the yaml is edited. */
export function flushLexiconDomainsCache(): void {
  cache = null;
}

export async function isKnownDomain(domainId: string): Promise<boolean> {
  const domains = await loadLexiconDomains();
  return domains.some((domain) => domain.id === domainId);
}
