/**
 * Capability 2 — Large Context Intelligence.
 *
 * ZAR already retrieves from many sources (core memory, foundation,
 * personalization, object memory, project filing, uploaded files,
 * semantic/episodic vectors). Retrieval alone is not intelligence: dumped
 * side by side those sources repeat each other and bury the few lines
 * that actually improve the answer.
 *
 * This engine turns Memory Retrieval into Context Intelligence. It treats
 * every retrieved block as one pool, ranks each by relevance to the live
 * query, dedupes overlapping lines across sources, compresses low-signal
 * blocks, and enforces a character budget — keeping only what improves
 * reasoning. Pinned sources (uploaded files, project instructions) are
 * never dropped; they can be compressed but always survive.
 *
 * It never fabricates: it only reorders, trims, and de-duplicates text
 * that retrieval already produced, so it is safe and behavior-preserving.
 */

import { keywords, words } from "./analysis";
import type { ContextIntelligenceResult } from "./types";

export interface ContextSection {
  label: string;
  text: string;
  /** Pinned sections always survive ranking (may still be compressed). */
  pinned?: boolean;
  /** Baseline importance independent of keyword overlap (0..1). */
  basePriority?: number;
}

export interface ContextIntelligenceOptions {
  /** Total character budget for the merged knowledge prompt. */
  budget?: number;
  /** Max characters any single non-pinned section may occupy. */
  perSectionCap?: number;
}

const DEFAULT_BUDGET = 14_000;
const DEFAULT_PER_SECTION_CAP = 4_500;

function normalizeLine(line: string): string {
  return line.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function lineRelevance(line: string, queryKeys: Set<string>): number {
  if (queryKeys.size === 0) return 0.5;
  const lineWords = new Set(words(line));
  let hits = 0;
  for (const k of queryKeys) if (lineWords.has(k)) hits += 1;
  return hits;
}

/**
 * Compress a block to a character cap by keeping its heading lines and
 * the lines most relevant to the query, preserving original order.
 */
function compressBlock(text: string, cap: number, queryKeys: Set<string>): string {
  if (text.length <= cap) return text;
  const lines = text.split("\n");
  const scored = lines.map((line, index) => {
    const isHeading = /^\s*#{1,6}\s/.test(line) || /^\s*##/.test(line);
    const isStructural = /^\s*[-*]\s/.test(line) || /:/.test(line);
    let score = lineRelevance(line, queryKeys);
    if (isHeading) score += 5;
    if (isStructural) score += 0.5;
    return { line, index, score, keep: false };
  });

  // Greedily keep highest-scoring lines until the cap is reached, then
  // re-emit in original order so the block still reads coherently.
  const order = [...scored].sort((a, b) => b.score - a.score || a.index - b.index);
  let used = 0;
  for (const item of order) {
    const cost = item.line.length + 1;
    if (used + cost > cap && !/^\s*#{1,6}\s/.test(item.line)) continue;
    item.keep = true;
    used += cost;
    if (used >= cap) break;
  }

  const kept = scored.filter((s) => s.keep).sort((a, b) => a.index - b.index);
  const result = kept.map((s) => s.line).join("\n").trim();
  return `${result}\n… (context compressed)`;
}

export class ContextIntelligenceEngine {
  static rank(
    query: string,
    sections: ContextSection[],
    options: ContextIntelligenceOptions = {},
  ): ContextIntelligenceResult {
    const budget = options.budget ?? DEFAULT_BUDGET;
    const perSectionCap = options.perSectionCap ?? DEFAULT_PER_SECTION_CAP;

    const usable = sections.filter((s) => s.text && s.text.trim().length > 0);
    const originalChars = usable.reduce((sum, s) => sum + s.text.length, 0);

    if (usable.length === 0) {
      return {
        prompt: "",
        keptSources: [],
        droppedSources: [],
        originalChars: 0,
        compressedChars: 0,
        compressionRatio: 1,
      };
    }

    const queryKeys = new Set(keywords(query));

    // Score each section: keyword density + base priority. Pinned
    // sections get a large boost so they sort to the top and survive.
    const scored = usable.map((section) => {
      const density = words(section.text).length
        ? [...queryKeys].filter((k) => section.text.toLowerCase().includes(k)).length
        : 0;
      const base = section.basePriority ?? 0.3;
      const score = (section.pinned ? 100 : 0) + density + base;
      return { section, score };
    });
    scored.sort((a, b) => b.score - a.score);

    // Cross-source de-duplication: once a substantive line has appeared
    // in a higher-ranked section, drop it from lower-ranked ones.
    const seenLines = new Set<string>();
    const keptSources: string[] = [];
    const droppedSources: string[] = [];
    const rendered: string[] = [];
    let used = 0;

    for (const { section } of scored) {
      const deduped = section.text
        .split("\n")
        .filter((line) => {
          const norm = normalizeLine(line);
          if (norm.length < 12) return true; // keep headings / short structural lines
          if (seenLines.has(norm)) return false;
          seenLines.add(norm);
          return true;
        })
        .join("\n")
        .trim();

      if (!deduped) {
        droppedSources.push(section.label);
        continue;
      }

      const cap = section.pinned ? Math.max(perSectionCap, 6_000) : perSectionCap;
      let block = deduped.length > cap ? compressBlock(deduped, cap, queryKeys) : deduped;

      // Budget enforcement — pinned sections are always admitted; others
      // are dropped once the budget is exhausted.
      if (!section.pinned && used + block.length > budget) {
        const remaining = budget - used;
        if (remaining < 400) {
          droppedSources.push(section.label);
          continue;
        }
        block = compressBlock(block, remaining, queryKeys);
      }

      rendered.push(block);
      keptSources.push(section.label);
      used += block.length;
    }

    const prompt = rendered.join("\n\n");
    return {
      prompt,
      keptSources,
      droppedSources,
      originalChars,
      compressedChars: prompt.length,
      compressionRatio: originalChars > 0 ? Number((prompt.length / originalChars).toFixed(2)) : 1,
    };
  }
}

export default ContextIntelligenceEngine;
