import fs from "fs/promises";
import path from "path";

import { mergeConversation, normalizeConversation } from "./normalize";
import {
  normalizeWhitespace,
  readJsonFile,
  sanitizeFileName,
  shortHash,
} from "./text-utils";
import {
  FOUNDATION_CONSENSUS_DIR,
  FOUNDATION_DOCS_DIR,
  FOUNDATION_EPISODIC_DIR,
  FOUNDATION_SEMANTIC_DIR,
  REPO_ROOT,
  type ExportConversation,
  type NormalizedConversation,
  type SourceManifest,
} from "./types";

/**
 * Copy strategic docs into the foundation imported-docs directory.
 * Each doc gets a content-hash suffix so the same doc imported from
 * two sources collapses to a single file, and a metadata header so
 * the origin is preserved.
 */
export async function writeFoundationDocs(manifests: SourceManifest[]): Promise<string[]> {
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
      const baseName =
        sanitizeFileName(path.basename(docPath, extension)) || `doc-${contentHash}`;
      const targetName = `${manifest.name}-${baseName}-${contentHash}${extension}`;
      const relativeSource = path.relative(REPO_ROOT, docPath).replace(/\\/g, "/");
      const body = `# Imported Foundation Document\n\n- Source: \`${manifest.name}\`\n- Original path: \`${relativeSource}\`\n- Imported: \`${new Date().toISOString()}\`\n\n---\n\n${normalized}\n`;

      await fs.writeFile(path.join(FOUNDATION_DOCS_DIR, targetName), body, "utf8");
      written.push(targetName);
    }
  }

  return written.sort();
}

/**
 * Two-pass de-dup: first by exact conversation id, then by content
 * fingerprint. Anything that hits an existing canonical bucket gets
 * mergeConversation()'d in. Result is sorted newest-first by
 * updatedAt for downstream artifacts.
 */
export async function buildMergedConversations(
  manifests: SourceManifest[],
): Promise<NormalizedConversation[]> {
  const byCanonicalKey = new Map<string, NormalizedConversation>();
  const canonicalByFingerprint = new Map<string, string>();

  for (const manifest of manifests) {
    const records = await readJsonFile<ExportConversation[]>(manifest.conversationsPath);
    for (const record of records) {
      const normalized = normalizeConversation(record, manifest.name);
      if (!normalized) {
        continue;
      }

      const canonicalKey = byCanonicalKey.has(normalized.conversationId)
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
  const totalMessages = conversations.reduce(
    (sum, conversation) => sum + conversation.messageCount,
    0,
  );
  const sources = manifests.map((manifest) => {
    const count = conversations.filter((conversation) =>
      conversation.sources.includes(manifest.name),
    ).length;
    return `- ${manifest.name}: ${count} canonical conversations`;
  });

  const latestConversations = conversations
    .slice(0, 12)
    .map(
      (conversation) =>
        `- ${conversation.title} (${conversation.updatedAt ?? "unknown"}) [${conversation.sources.join(", ")}]`,
    );

  const importedDocLines =
    importedDocs.length > 0
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

/**
 * Writes the five canonical output artifacts: full conversation
 * archive, summary manifest, source manifest, episodic timeline,
 * and the markdown overview.
 */
export async function writeArtifacts(
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
    messageCount: conversations.reduce(
      (sum, conversation) => sum + conversation.messageCount,
      0,
    ),
    importedDocCount: importedDocs.length,
    sources: manifests.map((manifest) => ({
      name: manifest.name,
      root: path.relative(REPO_ROOT, manifest.root).replace(/\\/g, "/"),
      conversationsPath: path
        .relative(REPO_ROOT, manifest.conversationsPath)
        .replace(/\\/g, "/"),
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
