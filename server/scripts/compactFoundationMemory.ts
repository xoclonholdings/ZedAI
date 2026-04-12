import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

interface NormalizedMessage {
  id: string;
  role: string;
  createTime: string | null;
  text: string;
}

interface NormalizedConversation {
  canonicalKey: string;
  conversationId: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  sources: string[];
  sourceConversationIds: string[];
  participants: string[];
  messageCount: number;
  preview: string;
  fingerprint: string;
  messages: NormalizedMessage[];
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const FOUNDATION_DIR = path.resolve(REPO_ROOT, "hub/shared-memory/semantic/foundation");
const FOUNDATION_CONSENSUS_DIR = path.resolve(REPO_ROOT, "hub/shared-memory/consensus/foundation");
const MERGED_CONVERSATIONS_PATH = path.resolve(FOUNDATION_DIR, "merged-conversations.json");
const MERGED_SUMMARY_PATH = path.resolve(FOUNDATION_DIR, "merged-summary.json");
const INDEX_PATH = path.resolve(FOUNDATION_DIR, "conversation-index.json");
const RECENT_PATH = path.resolve(FOUNDATION_DIR, "recent-conversations.json");
const SHARDS_DIR = path.resolve(FOUNDATION_DIR, "shards");
const YEAR_SHARDS_DIR = path.resolve(SHARDS_DIR, "by-year");
const SOURCE_SHARDS_DIR = path.resolve(SHARDS_DIR, "by-source");
const LIGHTWEIGHT_OVERVIEW_PATH = path.resolve(FOUNDATION_CONSENSUS_DIR, "lightweight-access.md");

function inferYear(conversation: NormalizedConversation): string {
  const candidate = conversation.updatedAt ?? conversation.createdAt;
  if (!candidate) {
    return "unknown";
  }

  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return String(date.getUTCFullYear());
}

function stripMessages(conversation: NormalizedConversation) {
  return {
    canonicalKey: conversation.canonicalKey,
    conversationId: conversation.conversationId,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    sources: conversation.sources,
    sourceConversationIds: conversation.sourceConversationIds,
    participants: conversation.participants,
    messageCount: conversation.messageCount,
    preview: conversation.preview,
    fingerprint: conversation.fingerprint,
  };
}

function topKeywords(text: string, limit = 12): string[] {
  const stopwords = new Set([
    "the", "and", "for", "that", "with", "this", "from", "your", "have", "will", "what", "about",
    "into", "they", "their", "there", "would", "could", "should", "just", "more", "when", "then",
    "than", "them", "were", "been", "because", "where", "while", "which", "also", "need", "make",
    "want", "like", "using", "used", "over", "only", "does", "into", "through", "between", "under",
    "after", "before", "being", "still", "each", "much", "many", "most", "some", "such", "very",
    "chatgpt", "zed", "agent", "agents",
  ]);

  const counts = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []) {
    if (stopwords.has(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([token]) => token);
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const conversations = await readJson<NormalizedConversation[]>(MERGED_CONVERSATIONS_PATH);
  const previousSummary = await readJson<Record<string, unknown>>(MERGED_SUMMARY_PATH);

  const index = conversations.map((conversation) => ({
    ...stripMessages(conversation),
    year: inferYear(conversation),
    keywords: topKeywords(`${conversation.title}\n${conversation.preview}`),
  }));

  const recent = index.slice(0, 60);

  const byYear = new Map<string, ReturnType<typeof stripMessages>[]>();
  const bySource = new Map<string, ReturnType<typeof stripMessages>[]>();

  for (const conversation of conversations) {
    const stripped = stripMessages(conversation);
    const year = inferYear(conversation);
    if (!byYear.has(year)) {
      byYear.set(year, []);
    }
    byYear.get(year)!.push(stripped);

    for (const source of conversation.sources) {
      if (!bySource.has(source)) {
        bySource.set(source, []);
      }
      bySource.get(source)!.push(stripped);
    }
  }

  await writeJson(INDEX_PATH, index);
  await writeJson(RECENT_PATH, recent);

  for (const [year, entries] of byYear.entries()) {
    await writeJson(path.join(YEAR_SHARDS_DIR, `${year}.json`), entries);
  }

  for (const [source, entries] of bySource.entries()) {
    await writeJson(path.join(SOURCE_SHARDS_DIR, `${source}.json`), entries);
  }

  const compactedSummary = {
    ...previousSummary,
    compactedAt: new Date().toISOString(),
    lightweightFiles: {
      index: "hub/shared-memory/semantic/foundation/conversation-index.json",
      recent: "hub/shared-memory/semantic/foundation/recent-conversations.json",
      shardsByYear: "hub/shared-memory/semantic/foundation/shards/by-year/",
      shardsBySource: "hub/shared-memory/semantic/foundation/shards/by-source/",
      fullArchive: "hub/shared-memory/semantic/foundation/merged-conversations.json",
    },
    shardCounts: {
      years: byYear.size,
      sources: bySource.size,
    },
  };

  await writeJson(MERGED_SUMMARY_PATH, compactedSummary);

  const lightweightOverview = `# Lightweight Foundation Access

Use the compact files first for reasoning and lookup, and only fall back to the full merged archive when the exact full message history is needed.

## Preferred Files

- Index: \`hub/shared-memory/semantic/foundation/conversation-index.json\`
- Recent set: \`hub/shared-memory/semantic/foundation/recent-conversations.json\`
- Year shards: \`hub/shared-memory/semantic/foundation/shards/by-year/\`
- Source shards: \`hub/shared-memory/semantic/foundation/shards/by-source/\`

## Cold Storage

- Full archive: \`hub/shared-memory/semantic/foundation/merged-conversations.json\`

## Current Shape

- Indexed conversations: ${index.length}
- Recent conversations tracked: ${recent.length}
- Year shards: ${byYear.size}
- Source shards: ${bySource.size}
`;

  await fs.writeFile(LIGHTWEIGHT_OVERVIEW_PATH, lightweightOverview, "utf8");

  console.log(`Compacted ${index.length} conversations into lightweight index and shards.`);
  console.log(`Created ${byYear.size} year shards and ${bySource.size} source shards.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
