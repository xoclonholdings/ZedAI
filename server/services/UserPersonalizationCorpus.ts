import fs from "fs/promises";
import path from "path";

import { HUB_DIR } from "../utils/repoPaths";
import { requireAuthenticatedMemoryUserId } from "./memory/MemoryOwnershipService";

/**
 * Per-user personalization corpus. Each user can drop notes about
 * themselves - background, working style, preferences, ongoing
 * projects - and those notes get injected into the Cognitive Core
 * knowledge slot at query time, ranked against the query so only
 * the relevant chunks show up.
 *
 * Storage layout:
 *   hub/user-personalization/<userId>/notes/<slug>.md
 *
 * Each read/write requires an authenticated user id. There is no
 * anonymous, default, or admin fallback; admin is just another owner
 * for their own personalization notes.
 */

const CORPUS_ROOT = path.join(HUB_DIR, "user-personalization");

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

export interface PersonalizationNote {
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface PersonalizationNoteSummary {
  slug: string;
  title: string;
  preview: string;
  updatedAt: string;
  bytes: number;
}

export interface PersonalizationRetrievalTraceItem {
  slug: string;
  title: string;
  score: number;
  excerpt: string;
}

export interface PersonalizationRetrievalResult {
  block: string;
  trace: PersonalizationRetrievalTraceItem[];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(title: string): string {
  const base = normalize(title).replace(/\s+/g, "-").slice(0, 60) || "note";
  return `${base}-${Date.now().toString(36)}`;
}

function extractKeywords(query: string): string[] {
  const parts = normalize(query)
    .split(" ")
    .filter((part) => part.length >= 3 && !STOP_WORDS.has(part));
  const out = new Set<string>(parts);
  for (let i = 0; i < parts.length - 1; i++) {
    out.add(`${parts[i]} ${parts[i + 1]}`);
  }
  return Array.from(out).slice(0, 20);
}

function scoreAgainst(content: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const norm = normalize(content);
  let score = 0;
  for (const kw of keywords) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = norm.match(new RegExp(`\\b${escaped}\\b`, "g"));
    if (matches) score += matches.length * (kw.includes(" ") ? 2 : 1);
  }
  return score;
}

function userDir(userId: string): string {
  const owner = requireAuthenticatedMemoryUserId(userId, "personalization corpus access");
  const safe = owner.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CORPUS_ROOT, safe, "notes");
}

async function ensureUserDir(userId: string): Promise<string> {
  const dir = userDir(userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function readNoteFile(dir: string, filename: string): Promise<PersonalizationNote | null> {
  if (!filename.endsWith(".md")) return null;
  try {
    const filepath = path.join(dir, filename);
    const [raw, stat] = await Promise.all([
      fs.readFile(filepath, "utf-8"),
      fs.stat(filepath),
    ]);
    const firstLine = raw.split("\n", 1)[0] || "";
    const title = firstLine.startsWith("# ")
      ? firstLine.replace(/^#\s+/, "").trim()
      : filename.replace(/\.md$/, "");
    return {
      slug: filename.replace(/\.md$/, ""),
      title: title || filename.replace(/\.md$/, ""),
      content: raw,
      updatedAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function listPersonalizationNotes(
  userId: string,
): Promise<PersonalizationNoteSummary[]> {
  const dir = userDir(userId);
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const notes = (await Promise.all(entries.map((filename) => readNoteFile(dir, filename))))
    .filter((n): n is PersonalizationNote => Boolean(n))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return notes.map((n) => ({
    slug: n.slug,
    title: n.title,
    preview: n.content.replace(/^#\s+.*\n/, "").slice(0, 220).trim(),
    updatedAt: n.updatedAt,
    bytes: Buffer.byteLength(n.content, "utf-8"),
  }));
}

export async function readPersonalizationNote(
  userId: string,
  slug: string,
): Promise<PersonalizationNote | null> {
  return readNoteFile(userDir(userId), `${slug}.md`);
}

export interface SavePersonalizationInput {
  userId: string;
  slug?: string;
  title: string;
  content: string;
}

export async function savePersonalizationNote(
  input: SavePersonalizationInput,
): Promise<PersonalizationNote> {
  const dir = await ensureUserDir(input.userId);
  const slug = input.slug || slugify(input.title);
  const filepath = path.join(dir, `${slug}.md`);
  const body = input.content.startsWith("# ")
    ? input.content
    : `# ${input.title}\n\n${input.content}`;
  await fs.writeFile(filepath, body, "utf-8");
  const stat = await fs.stat(filepath);
  return {
    slug,
    title: input.title,
    content: body,
    updatedAt: stat.mtime.toISOString(),
  };
}

export async function deletePersonalizationNote(
  userId: string,
  slug: string,
): Promise<boolean> {
  const filepath = path.join(userDir(userId), `${slug}.md`);
  try {
    await fs.unlink(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Query-time retrieval. Returns a formatted markdown block and a
 * trace of what got ranked. When the corpus is empty or nothing
 * scores above zero, the block is an empty string so KnowledgeService
 * can safely filter(Boolean) it out.
 */
export async function retrievePersonalizationForQuery(
  userId: string,
  query: string,
  limit = 3,
): Promise<PersonalizationRetrievalResult> {
  const dir = userDir(userId);
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return { block: "", trace: [] };
  }
  if (entries.length === 0) return { block: "", trace: [] };

  const notes = (await Promise.all(entries.map((filename) => readNoteFile(dir, filename))))
    .filter((n): n is PersonalizationNote => Boolean(n));

  const keywords = extractKeywords(query);

  const scored = notes
    .map((note) => ({ note, score: scoreAgainst(note.content, keywords) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) return { block: "", trace: [] };

  const trace: PersonalizationRetrievalTraceItem[] = scored.map((entry) => ({
    slug: entry.note.slug,
    title: entry.note.title,
    score: entry.score,
    excerpt: entry.note.content.replace(/^#\s+.*\n/, "").slice(0, 180).trim(),
  }));

  const block = [
    "## Personal context provided by the user",
    "The user has shared these notes about themselves; use them to personalize the response but do not read them verbatim to the user unless asked.",
    ...scored.map((entry) => {
      const body = entry.note.content.replace(/^#\s+.*\n/, "").trim();
      return `### ${entry.note.title}\n${body.slice(0, 1200)}`;
    }),
  ].join("\n\n");

  return { block, trace };
}
