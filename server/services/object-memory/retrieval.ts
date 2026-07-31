import { readAppliedGraph } from "./store";
import type { AnyMemoryObject } from "../../../shared/object-memory-types";

/**
 * Selective retrieval of object memory for the Cognitive Core.
 *
 * Never dumps the whole graph — that would defeat the purpose. Only
 * emits the top-K objects most relevant to the current query, plus a
 * count so the trace layer can record how much was pulled in.
 */

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "have",
  "from",
  "your",
  "what",
  "when",
  "which",
  "into",
  "about",
  "project",
]);

function keywords(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w)),
    ),
  );
}

function score(obj: AnyMemoryObject, keys: string[]): number {
  if (keys.length === 0) return 0;
  const haystack = [
    obj.canonicalName,
    obj.summary,
    ...(obj.aliases || []),
    JSON.stringify(obj.properties),
    JSON.stringify(obj.sourceRefs || []),
  ]
    .join(" ")
    .toLowerCase();
  let s = 0;
  for (const k of keys) {
    if (haystack.includes(k)) s += 1;
  }
  return s * obj.confidence;
}

export interface ObjectRetrievalResult {
  block: string;
  count: number;
  ids: string[];
}

export async function retrieveObjectMemoryForQuery(
  query: string,
  limit = 5,
  userId?: string,
): Promise<ObjectRetrievalResult> {
  const graph = await readAppliedGraph(userId ? { userId } : undefined);
  if (!graph) return { block: "", count: 0, ids: [] };
  const keys = keywords(query);
  if (keys.length === 0) return { block: "", count: 0, ids: [] };

  const scored = graph.objects
    .map((obj) => ({ obj, score: score(obj, keys) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) return { block: "", count: 0, ids: [] };

  const block = [
    "## Object memory retrieved for this query",
    "The following are structured objects that ZAR has extracted from prior conversations and knowledge. Use them as ground truth for stable facts about projects, systems, decisions, and user preferences.",
    ...scored.map(({ obj }) => {
      const parts = [
        `### ${obj.canonicalName} (${obj.type})`,
        `${obj.summary}`,
      ];
      const props = obj.properties as Record<string, unknown>;
      const filled = Object.entries(props).filter(
        ([, v]) => v !== undefined && v !== null && (typeof v !== "string" || v.length > 0),
      );
      if (filled.length > 0) {
        parts.push(
          filled
            .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
            .join("\n"),
        );
      }
      return parts.join("\n");
    }),
  ].join("\n\n");

  return {
    block,
    count: scored.length,
    ids: scored.map(({ obj }) => obj.id),
  };
}
