import fs from "fs/promises";
import path from "path";
import { HUB_SHARED_MEMORY_DIR } from "../utils/repoPaths";

const FOUNDATION_OVERVIEW = path.resolve(HUB_SHARED_MEMORY_DIR, "consensus/foundation/foundation-overview.md");
const FOUNDATION_DOCS_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "consensus/foundation/imported-docs");

function extractKeywords(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 4)
    )
  ).slice(0, 8);
}

function bestMatchingLines(content: string, keywords: string[], limit = 6): string[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => ({
      line,
      score: keywords.reduce((sum, keyword) => sum + (line.toLowerCase().includes(keyword) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.line.length - a.line.length)
    .slice(0, limit)
    .map((entry) => entry.line);
}

export async function retrieveFoundationMemory(query: string, options?: { enabled?: boolean }): Promise<string> {
  if (options?.enabled === false) return "";
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return "";

  const blocks: string[] = [];

  try {
    const overview = await fs.readFile(FOUNDATION_OVERVIEW, "utf-8");
    const lines = bestMatchingLines(overview, keywords, 4);
    if (lines.length > 0) {
      blocks.push(`## Foundation Overview\n${lines.join("\n")}`);
    }
  } catch {}

  try {
    const files = (await fs.readdir(FOUNDATION_DOCS_DIR)).filter((name) => name.endsWith(".md") || name.endsWith(".txt"));
    for (const file of files) {
      const content = await fs.readFile(path.join(FOUNDATION_DOCS_DIR, file), "utf-8");
      const lines = bestMatchingLines(content, keywords, 3);
      if (lines.length > 0) {
        blocks.push(`## ${file}\n${lines.join("\n")}`);
      }
      if (blocks.length >= 3) break;
    }
  } catch {}

  return blocks.join("\n\n");
}
