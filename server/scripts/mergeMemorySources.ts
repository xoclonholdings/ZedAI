import {
  buildMergedConversations,
  writeArtifacts,
  writeFoundationDocs,
} from "./merge-memory/artifacts";
import { buildSourceManifests } from "./merge-memory/sources";

/**
 * Entry point for the legacy ChatGPT memory import pipeline. Walks
 * the dragonfly + zed-memory exports on disk, normalizes and merges
 * their conversations, and writes the canonical foundation artifacts
 * that ZED's hub memory layer reads at runtime.
 *
 * The actual work lives in ./merge-memory/:
 *   types.ts       — shared types and path constants
 *   text-utils.ts  — small pure helpers (hashing, whitespace, file IO)
 *   normalize.ts   — single-conversation normalization + cross-source merge
 *   sources.ts     — disk discovery for legacy export roots
 *   artifacts.ts   — the five output writers
 */
async function main(): Promise<void> {
  const manifests = await buildSourceManifests();
  if (manifests.length === 0) {
    throw new Error("No legacy memory sources were found to merge.");
  }

  const importedDocs = await writeFoundationDocs(manifests);
  const conversations = await buildMergedConversations(manifests);
  await writeArtifacts(manifests, conversations, importedDocs);

  console.log(
    `Merged ${conversations.length} canonical conversations from ${manifests.length} sources.`,
  );
  console.log(
    `Imported ${importedDocs.length} strategic text documents into hub/shared-memory/consensus/foundation/imported-docs.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
