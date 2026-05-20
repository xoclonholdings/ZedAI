import type { VectorEntry } from "../ChromaService";

import { safeExcerpt } from "./scoring";

/**
 * Core-memory values are stored as JSON strings; show the original
 * string if it parses to one, or a pretty-printed JSON otherwise.
 * Falls back to the raw string if parsing fails — better to show
 * the literal value than to silently drop it.
 */
export function parseCoreValue(value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "string") return parsed;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export function formatCoreMemory(
  entries: Array<{ key: string; value: string }>,
): string {
  if (entries.length === 0) return "";

  return entries
    .map((entry) => `### ${entry.key}\n${safeExcerpt(parseCoreValue(entry.value), 700)}`)
    .join("\n\n");
}

/**
 * Render retrieved vector-store entries with a derived source
 * label — `topic` if present, conversation id slice if present,
 * else the literal "memory".
 */
export function formatRetrievedMemory(entries: VectorEntry[]): string {
  if (entries.length === 0) return "";

  return entries
    .map((entry, index) => {
      const source =
        typeof entry.metadata?.topic === "string"
          ? String(entry.metadata.topic)
          : typeof entry.metadata?.conversationId === "string"
            ? `conversation ${String(entry.metadata.conversationId).slice(0, 8)}`
            : "memory";
      return `### Retrieved Memory ${index + 1} (${source})\n${safeExcerpt(entry.document, 380)}`;
    })
    .join("\n\n");
}

/**
 * De-duplicate retrieved entries by the first 180 characters of
 * their document body. Episodic and semantic stores frequently
 * return overlapping content (same conversation snippet, different
 * shard) — this collapses those without losing the first hit.
 */
export function dedupeRetrievedMemory(entries: VectorEntry[]): VectorEntry[] {
  const seen = new Set<string>();
  const output: VectorEntry[] = [];

  for (const entry of entries) {
    const key = safeExcerpt(entry.document, 180).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(entry);
  }

  return output;
}
