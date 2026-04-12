import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

type SourceName = "dragonfly" | "zed-memory";

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
  sources: SourceName[];
  sourceConversationIds: string[];
  participants: string[];
  messageCount: number;
  preview: string;
  fingerprint: string;
  messages: NormalizedMessage[];
}

interface SourceManifest {
  name: SourceName;
  root: string;
  conversationsPath: string;
  strategicDocPaths: string[];
}

interface ExportConversation {
  id?: string;
  conversation_id?: string;
  title?: string;
  create_time?: number;
  update_time?: number;
  mapping?: Record<string, any>;
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const HUB_SHARED_MEMORY_DIR = path.resolve(REPO_ROOT, "hub/shared-memory");
const FOUNDATION_CONSENSUS_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "consensus/foundation");
const FOUNDATION_DOCS_DIR = path.resolve(FOUNDATION_CONSENSUS_DIR, "imported-docs");
const FOUNDATION_SEMANTIC_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "semantic/foundation");
const FOUNDATION_EPISODIC_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "episodic/imported");

const DRAGONFLY_ROOT = path.resolve(REPO_ROOT, "dragonfly");
const DRAGONFLY_CONVERSATIONS = path.resolve(DRAGONFLY_ROOT, "conversations.json");
const ZED_MEMORY_ROOT = path.resolve(REPO_ROOT, "zed-memory/storage/ZedAI_data/Zed_Memory_GPT/Zed_Memory_part2");
const ZED_MEMORY_CONVERSATIONS = path.resolve(ZED_MEMORY_ROOT, "conversations.json");

const STRATEGIC_DOC_PATTERN = /(plan|gameplan|build|strategy|strategic)/i;
const TEXT_EXTENSIONS = new Set([".md", ".txt"]);
const MAX_PREVIEW_LENGTH = 600;

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
}

function toIsoTime(input?: number | null): string | null {
  if (!input || Number.isNaN(input)) {
    return null;
  }

  const date = new Date(input * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function summarizePreview(messages: NormalizedMessage[]): string {
  const body = messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role}: ${message.text}`)
    .join("\n");

  return body.slice(0, MAX_PREVIEW_LENGTH).trim();
}

function extractTextFromContent(content: any): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return normalizeWhitespace(content.map((part) => extractTextFromContent(part)).filter(Boolean).join("\n"));
  }

  if (typeof content === "object") {
    if (Array.isArray(content.parts)) {
      return extractTextFromContent(content.parts);
    }

    if (typeof content.text === "string") {
      return normalizeWhitespace(content.text);
    }

    if (typeof content.result === "string") {
      return normalizeWhitespace(content.result);
    }
  }

  return "";
}

function normalizeConversation(input: ExportConversation, source: SourceName): NormalizedConversation | null {
  const mapping = input.mapping ?? {};
  const messages: NormalizedMessage[] = [];

  for (const [nodeId, node] of Object.entries(mapping)) {
    const message = (node as any)?.message;
    const role = message?.author?.role;
    const text = extractTextFromContent(message?.content);

    if (!role || !text) {
      continue;
    }

    messages.push({
      id: String(message?.id ?? nodeId),
      role: String(role),
      createTime: toIsoTime(message?.create_time ?? node?.create_time ?? null),
      text,
    });
  }

  if (messages.length === 0) {
    return null;
  }

  messages.sort((left, right) => {
    const leftValue = left.createTime ? Date.parse(left.createTime) : 0;
    const rightValue = right.createTime ? Date.parse(right.createTime) : 0;
    return leftValue - rightValue;
  });

  const title = normalizeWhitespace(input.title || "Untitled conversation");
  const conversationId = String(input.conversation_id ?? input.id ?? `${source}-${shortHash(title)}`);
  const fingerprintSeed = [
    title.toLowerCase(),
    ...messages.slice(0, 8).map((message) => `${message.role}:${message.text.toLowerCase().slice(0, 300)}`),
  ].join("\n");
  const fingerprint = shortHash(fingerprintSeed);

  return {
    canonicalKey: conversationId,
    conversationId,
    title,
    createdAt: toIsoTime(input.create_time ?? null),
    updatedAt: toIsoTime(input.update_time ?? null),
    sources: [source],
    sourceConversationIds: [conversationId],
    participants: [...new Set(messages.map((message) => message.role))],
    messageCount: messages.length,
    preview: summarizePreview(messages),
    fingerprint,
    messages,
  };
}

function mergeConversation(existing: NormalizedConversation, incoming: NormalizedConversation): NormalizedConversation {
  const mergedMessageMap = new Map<string, NormalizedMessage>();
  for (const message of [...existing.messages, ...incoming.messages]) {
    const key = `${message.role}|${message.createTime ?? "unknown"}|${message.text}`;
    if (!mergedMessageMap.has(key)) {
      mergedMessageMap.set(key, message);
    }
  }

  const messages = [...mergedMessageMap.values()].sort((left, right) => {
    const leftValue = left.createTime ? Date.parse(left.createTime) : 0;
    const rightValue = right.createTime ? Date.parse(right.createTime) : 0;
    return leftValue - rightValue;
  });

  const title = existing.title.length >= incoming.title.length ? existing.title : incoming.title;
  const createdAt = [existing.createdAt, incoming.createdAt].filter(Boolean).sort()[0] ?? null;
  const updatedAt = [existing.updatedAt, incoming.updatedAt].filter(Boolean).sort().slice(-1)[0] ?? null;

  return {
    canonicalKey: existing.canonicalKey,
    conversationId: existing.conversationId,
    title,
    createdAt,
    updatedAt,
    sources: [...new Set([...existing.sources, ...incoming.sources])],
    sourceConversationIds: [...new Set([...existing.sourceConversationIds, ...incoming.sourceConversationIds])],
    participants: [...new Set([...existing.participants, ...incoming.participants])],
    messageCount: messages.length,
    preview: summarizePreview(messages),
    fingerprint: existing.fingerprint,
    messages,
  };
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function collectStrategicDocs(root: string): Promise<string[]> {
  const docs: string[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(extension)) {
        continue;
      }

      if (STRATEGIC_DOC_PATTERN.test(entry.name)) {
        docs.push(entryPath);
      }
    }
  }

  return docs.sort();
}

async function buildSourceManifests(): Promise<SourceManifest[]> {
  const manifests: SourceManifest[] = [];

  if (await pathExists(DRAGONFLY_CONVERSATIONS)) {
    manifests.push({
      name: "dragonfly",
      root: DRAGONFLY_ROOT,
      conversationsPath: DRAGONFLY_CONVERSATIONS,
      strategicDocPaths: await collectStrategicDocs(DRAGONFLY_ROOT),
    });
  }

  if (await pathExists(ZED_MEMORY_CONVERSATIONS)) {
    manifests.push({
      name: "zed-memory",
      root: ZED_MEMORY_ROOT,
      conversationsPath: ZED_MEMORY_CONVERSATIONS,
      strategicDocPaths: await collectStrategicDocs(ZED_MEMORY_ROOT),
    });
  }

  return manifests;
}

async function writeFoundationDocs(manifests: SourceManifest[]): Promise<string[]> {
  await fs.mkdir(FOUNDATION_DOCS_DIR, { recursive: true });
  const written: string[] = [];
  const seenContent = new Set<string>();

  for (const manifest of manifests) {
    for (const docPath of manifest.strategicDocPaths) {
      const raw = await fs.readFile(docPath, "utf8");
      const normalized = normalizeWhitespace(raw);
      if (!normalized) {
        continue;
      }

      const contentHash = shortHash(normalized.toLowerCase());
      if (seenContent.has(contentHash)) {
        continue;
      }

      seenContent.add(contentHash);
      const extension = path.extname(docPath).toLowerCase() || ".md";
      const baseName = sanitizeFileName(path.basename(docPath, extension)) || `doc-${contentHash}`;
      const targetName = `${manifest.name}-${baseName}-${contentHash}${extension}`;
      const relativeSource = path.relative(REPO_ROOT, docPath).replace(/\\/g, "/");
      const body = `# Imported Foundation Document\n\n- Source: \`${manifest.name}\`\n- Original path: \`${relativeSource}\`\n- Imported: \`${new Date().toISOString()}\`\n\n---\n\n${normalized}\n`;

      await fs.writeFile(path.join(FOUNDATION_DOCS_DIR, targetName), body, "utf8");
      written.push(targetName);
    }
  }

  return written.sort();
}

async function buildMergedConversations(manifests: SourceManifest[]): Promise<NormalizedConversation[]> {
  const byCanonicalKey = new Map<string, NormalizedConversation>();
  const canonicalByFingerprint = new Map<string, string>();

  for (const manifest of manifests) {
    const records = await readJsonFile<ExportConversation[]>(manifest.conversationsPath);
    for (const record of records) {
      const normalized = normalizeConversation(record, manifest.name);
      if (!normalized) {
        continue;
      }

      const canonicalKey =
        byCanonicalKey.has(normalized.conversationId)
          ? normalized.conversationId
          : canonicalByFingerprint.get(normalized.fingerprint) ?? normalized.conversationId;

      if (!byCanonicalKey.has(canonicalKey)) {
        normalized.canonicalKey = canonicalKey;
        byCanonicalKey.set(canonicalKey, normalized);
        canonicalByFingerprint.set(normalized.fingerprint, canonicalKey);
        continue;
      }

      const merged = mergeConversation(byCanonicalKey.get(canonicalKey)!, normalized);
      byCanonicalKey.set(canonicalKey, merged);
      canonicalByFingerprint.set(merged.fingerprint, canonicalKey);
    }
  }

  return [...byCanonicalKey.values()].sort((left, right) => {
    const leftValue = left.updatedAt ? Date.parse(left.updatedAt) : 0;
    const rightValue = right.updatedAt ? Date.parse(right.updatedAt) : 0;
    return rightValue - leftValue;
  });
}

function buildFoundationOverview(
  manifests: SourceManifest[],
  conversations: NormalizedConversation[],
  importedDocs: string[],
): string {
  const totalMessages = conversations.reduce((sum, conversation) => sum + conversation.messageCount, 0);
  const sources = manifests.map((manifest) => {
    const count = conversations.filter((conversation) => conversation.sources.includes(manifest.name)).length;
    return `- ${manifest.name}: ${count} canonical conversations`;
  });

  const latestConversations = conversations
    .slice(0, 12)
    .map((conversation) => `- ${conversation.title} (${conversation.updatedAt ?? "unknown"}) [${conversation.sources.join(", ")}]`);

  const importedDocLines = importedDocs.length > 0
    ? importedDocs.map((name) => `- ${name}`)
    : ["- No strategic text documents were imported."];

  return `# Foundation Memory Overview

This file is the canonical summary of imported legacy ChatGPT knowledge that now feeds the active ZED hub memory.

## Import Summary

- Imported on: ${new Date().toISOString()}
- Canonical conversation count: ${conversations.length}
- Canonical message count: ${totalMessages}
- Imported strategic docs: ${importedDocs.length}

## Source Coverage

${sources.join("\n")}

## Canonical Files

- Semantic archive: \`hub/shared-memory/semantic/foundation/merged-conversations.json\`
- Summary manifest: \`hub/shared-memory/semantic/foundation/merged-summary.json\`
- Source manifest: \`hub/shared-memory/semantic/foundation/source-manifest.json\`
- Timeline view: \`hub/shared-memory/episodic/imported/conversation-timeline.json\`
- Imported docs: \`hub/shared-memory/consensus/foundation/imported-docs/\`

## Imported Strategic Docs

${importedDocLines.join("\n")}

## Most Recent Canonical Conversations

${latestConversations.join("\n")}
`;
}

async function writeArtifacts(
  manifests: SourceManifest[],
  conversations: NormalizedConversation[],
  importedDocs: string[],
): Promise<void> {
  await fs.mkdir(FOUNDATION_SEMANTIC_DIR, { recursive: true });
  await fs.mkdir(FOUNDATION_EPISODIC_DIR, { recursive: true });
  await fs.mkdir(FOUNDATION_CONSENSUS_DIR, { recursive: true });

  const timeline = conversations.map((conversation) => ({
    canonicalKey: conversation.canonicalKey,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    sources: conversation.sources,
    participants: conversation.participants,
    messageCount: conversation.messageCount,
    preview: conversation.preview,
  }));

  const summary = {
    importedAt: new Date().toISOString(),
    sourceCount: manifests.length,
    conversationCount: conversations.length,
    messageCount: conversations.reduce((sum, conversation) => sum + conversation.messageCount, 0),
    importedDocCount: importedDocs.length,
    sources: manifests.map((manifest) => ({
      name: manifest.name,
      root: path.relative(REPO_ROOT, manifest.root).replace(/\\/g, "/"),
      conversationsPath: path.relative(REPO_ROOT, manifest.conversationsPath).replace(/\\/g, "/"),
      strategicDocCount: manifest.strategicDocPaths.length,
    })),
  };

  await fs.writeFile(
    path.join(FOUNDATION_SEMANTIC_DIR, "merged-conversations.json"),
    `${JSON.stringify(conversations, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(FOUNDATION_SEMANTIC_DIR, "merged-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(FOUNDATION_SEMANTIC_DIR, "source-manifest.json"),
    `${JSON.stringify(manifests, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(FOUNDATION_EPISODIC_DIR, "conversation-timeline.json"),
    `${JSON.stringify(timeline, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(FOUNDATION_CONSENSUS_DIR, "foundation-overview.md"),
    buildFoundationOverview(manifests, conversations, importedDocs),
    "utf8",
  );
}

async function main(): Promise<void> {
  const manifests = await buildSourceManifests();
  if (manifests.length === 0) {
    throw new Error("No legacy memory sources were found to merge.");
  }

  const importedDocs = await writeFoundationDocs(manifests);
  const conversations = await buildMergedConversations(manifests);
  await writeArtifacts(manifests, conversations, importedDocs);

  console.log(`Merged ${conversations.length} canonical conversations from ${manifests.length} sources.`);
  console.log(`Imported ${importedDocs.length} strategic text documents into hub/shared-memory/consensus/foundation/imported-docs.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
