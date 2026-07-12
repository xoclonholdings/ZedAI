import fs from "fs/promises";
import path from "path";
import { HUB_SHARED_MEMORY_DIR, HUB_USER_MEMORY_DIR } from "../utils/repoPaths";

type FoundationPaths = {
  overview: string;
  docsDir: string;
  summary: string;
  sourceShardsDir: string;
};

const LEGACY_FOUNDATION_PATHS: FoundationPaths = {
  overview: path.resolve(HUB_SHARED_MEMORY_DIR, "consensus/foundation/foundation-overview.md"),
  docsDir: path.resolve(HUB_SHARED_MEMORY_DIR, "consensus/foundation/imported-docs"),
  summary: path.resolve(HUB_SHARED_MEMORY_DIR, "semantic/foundation/merged-summary.json"),
  sourceShardsDir: path.resolve(HUB_SHARED_MEMORY_DIR, "semantic/foundation/shards/by-source"),
};

type MemoryBlock = {
  title: string;
  content: string;
  source: string;
};

type RankedBlock = MemoryBlock & { score: number };
export type FoundationTraceItem = {
  title: string;
  source: string;
  excerpt: string;
  score: number;
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "being",
  "could",
  "doing",
  "from",
  "have",
  "into",
  "just",
  "more",
  "need",
  "than",
  "that",
  "them",
  "then",
  "they",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your",
]);

function safeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_") || "user";
}

function adminFoundationPaths(userId: string): FoundationPaths {
  const root = path.resolve(HUB_USER_MEMORY_DIR, safeUserId(userId), "foundation");
  return {
    overview: path.join(root, "consensus/foundation-overview.md"),
    docsDir: path.join(root, "consensus/imported-docs"),
    summary: path.join(root, "semantic/merged-summary.json"),
    sourceShardsDir: path.join(root, "semantic/shards/by-source"),
  };
}

function foundationPathCandidates(userId?: string): FoundationPaths[] {
  return userId
    ? [adminFoundationPaths(userId), LEGACY_FOUNDATION_PATHS]
    : [LEGACY_FOUNDATION_PATHS];
}

async function firstNonEmpty(
  candidates: FoundationPaths[],
  load: (paths: FoundationPaths) => Promise<MemoryBlock[]>,
): Promise<MemoryBlock[]> {
  for (const candidate of candidates) {
    const blocks = await load(candidate);
    if (blocks.length > 0) return blocks;
  }
  return [];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function extractKeywords(query: string): string[] {
  const parts = normalize(query)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOP_WORDS.has(part));

  const output = new Set<string>(parts);

  for (let i = 0; i < parts.length - 1; i++) {
    output.add(`${parts[i]} ${parts[i + 1]}`);
  }

  return Array.from(output).slice(0, 18);
}

function splitMarkdownSections(content: string): string[] {
  const sections = content
    .split(/\n(?=##?\s)/g)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length > 0) return sections;

  return content
    .split(/\n\s*\n/g)
    .map((section) => section.trim())
    .filter(Boolean);
}

function scoreText(text: string, keywords: string[]): number {
  const haystack = normalize(text);
  return keywords.reduce((score, keyword) => {
    if (!keyword) return score;
    if (!haystack.includes(keyword)) return score;
    return score + (keyword.includes(" ") ? 4 : keyword.length >= 6 ? 3 : 2);
  }, 0);
}

function rankBlocks(blocks: MemoryBlock[], keywords: string[], limit: number): RankedBlock[] {
  return blocks
    .map((block) => ({
      ...block,
      score:
        scoreText(block.title, keywords) * 3 +
        scoreText(block.source, keywords) * 2 +
        scoreText(block.content, keywords),
    }))
    .filter((block) => block.score > 0)
    .sort((a, b) => b.score - a.score || b.content.length - a.content.length)
    .slice(0, limit);
}

async function loadOverviewBlocksFrom(paths: FoundationPaths): Promise<MemoryBlock[]> {
  try {
    const content = await fs.readFile(paths.overview, "utf-8");
    return splitMarkdownSections(content).map((section, index) => ({
      title: index === 0 ? "Foundation Overview" : `Foundation Overview ${index + 1}`,
      content: section,
      source: "foundation-overview",
    }));
  } catch {
    return [];
  }
}

async function loadImportedDocBlocksFrom(paths: FoundationPaths): Promise<MemoryBlock[]> {
  try {
    const files = (await fs.readdir(paths.docsDir)).filter((name) => name.endsWith(".md") || name.endsWith(".txt"));
    const output: MemoryBlock[] = [];

    for (const file of files) {
      const content = await fs.readFile(path.join(paths.docsDir, file), "utf-8");
      const sections = splitMarkdownSections(content).slice(0, 10);
      for (const section of sections) {
        output.push({
          title: file,
          content: section,
          source: file,
        });
      }
    }

    return output;
  } catch {
    return [];
  }
}

async function loadSummaryBlocksFrom(paths: FoundationPaths): Promise<MemoryBlock[]> {
  try {
    const raw = await fs.readFile(paths.summary, "utf-8");
    const parsed = JSON.parse(raw);
    const collections = [
      ...(Array.isArray(parsed?.mostRecentConversations) ? parsed.mostRecentConversations : []),
      ...(Array.isArray(parsed?.topTopics) ? parsed.topTopics : []),
      ...(Array.isArray(parsed?.strategicHighlights) ? parsed.strategicHighlights : []),
    ];

    return collections
      .map((entry: any, index: number) => ({
        title: entry?.title || entry?.topic || `Summary ${index + 1}`,
        content: [entry?.summary, entry?.preview, entry?.details, entry?.description].filter(Boolean).join("\n"),
        source: "merged-summary",
      }))
      .filter((entry) => entry.content);
  } catch {
    return [];
  }
}

async function loadSourceShardBlocksFrom(paths: FoundationPaths): Promise<MemoryBlock[]> {
  try {
    const files = (await fs.readdir(paths.sourceShardsDir)).filter((name) => name.endsWith(".json"));
    const output: MemoryBlock[] = [];

    for (const file of files) {
      const raw = await fs.readFile(path.join(paths.sourceShardsDir, file), "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;

      for (const entry of parsed.slice(0, 250)) {
        output.push({
          title: entry?.title || entry?.canonicalKey || file,
          content: [entry?.preview, entry?.createdAt, entry?.updatedAt, Array.isArray(entry?.sources) ? entry.sources.join(", ") : ""]
            .filter(Boolean)
            .join("\n"),
          source: file.replace(".json", ""),
        });
      }
    }

    return output;
  } catch {
    return [];
  }
}

function formatBlocks(blocks: RankedBlock[]): string {
  return blocks
    .map((block) => `## ${block.title}\n${block.content}`)
    .join("\n\n");
}

export async function retrieveFoundationMemoryWithTrace(
  query: string,
  options?: { enabled?: boolean; userId?: string },
): Promise<{ content: string; trace: FoundationTraceItem[] }> {
  if (options?.enabled === false) return { content: "", trace: [] };

  const keywords = extractKeywords(query);
  if (keywords.length === 0) return { content: "", trace: [] };

  const candidates = foundationPathCandidates(options?.userId);
  const [overviewBlocks, importedDocBlocks, summaryBlocks, sourceShardBlocks] = await Promise.all([
    firstNonEmpty(candidates, loadOverviewBlocksFrom),
    firstNonEmpty(candidates, loadImportedDocBlocksFrom),
    firstNonEmpty(candidates, loadSummaryBlocksFrom),
    firstNonEmpty(candidates, loadSourceShardBlocksFrom),
  ]);

  const rankedOverview = rankBlocks(overviewBlocks, keywords, 2);
  const rankedImported = rankBlocks(importedDocBlocks, keywords, 3);
  const rankedSummary = rankBlocks(summaryBlocks, keywords, 2);
  const rankedShard = rankBlocks(sourceShardBlocks, keywords, 3);

  const deduped = Array.from(
    new Map(
      [...rankedOverview, ...rankedImported, ...rankedSummary, ...rankedShard].map((block) => [
        `${block.title}:${normalize(block.content).slice(0, 120)}`,
        block,
      ]),
    ).values(),
  )
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return {
    content: formatBlocks(deduped),
    trace: deduped.map((block) => ({
      title: block.title,
      source: block.source,
      excerpt: block.content.replace(/\s+/g, " ").trim().slice(0, 280),
      score: block.score,
    })),
  };
}

export async function retrieveFoundationMemory(
  query: string,
  options?: { enabled?: boolean; userId?: string },
): Promise<string> {
  const result = await retrieveFoundationMemoryWithTrace(query, options);
  return result.content;
}
