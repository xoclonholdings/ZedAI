import { createHash } from "crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 16)}`;
}

export function normalizeSpace(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/** Lowercased, punctuation-stripped lookup key — the same normalization
 *  knowledge-ingestion uses for its object dedupe key, kept consistent
 *  so the two subsystems agree on what counts as "the same word." */
export function normalizeKey(value: string): string {
  return normalizeSpace(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
