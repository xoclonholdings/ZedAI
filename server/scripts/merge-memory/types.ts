import path from "path";
import { fileURLToPath } from "url";

export type SourceName = "dragonfly" | "zed-memory";

export interface NormalizedMessage {
  id: string;
  role: string;
  createTime: string | null;
  text: string;
}

export interface NormalizedConversation {
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

export interface SourceManifest {
  name: SourceName;
  root: string;
  conversationsPath: string;
  strategicDocPaths: string[];
}

/**
 * Shape of one conversation as it appears in a raw ChatGPT export
 * JSON file. Many fields are optional because legacy exports omit
 * them — normalizeConversation walks the `mapping` tree to recover
 * what it can.
 */
export interface ExportConversation {
  id?: string;
  conversation_id?: string;
  title?: string;
  create_time?: number;
  update_time?: number;
  mapping?: Record<string, any>;
}

// Resolve repo-relative paths from the script's own location so this
// works when the script is invoked from any cwd.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");

export const HUB_SHARED_MEMORY_DIR = path.resolve(REPO_ROOT, "hub/shared-memory");
export const FOUNDATION_CONSENSUS_DIR = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "consensus/foundation",
);
export const FOUNDATION_DOCS_DIR = path.resolve(FOUNDATION_CONSENSUS_DIR, "imported-docs");
export const FOUNDATION_SEMANTIC_DIR = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "semantic/foundation",
);
export const FOUNDATION_EPISODIC_DIR = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "episodic/imported",
);

export const DRAGONFLY_ROOT = path.resolve(REPO_ROOT, "dragonfly");
export const DRAGONFLY_CONVERSATIONS = path.resolve(DRAGONFLY_ROOT, "conversations.json");
export const ZED_MEMORY_ROOT = path.resolve(
  REPO_ROOT,
  "zed-memory/storage/ZedAI_data/Zed_Memory_GPT/Zed_Memory_part2",
);
export const ZED_MEMORY_CONVERSATIONS = path.resolve(
  ZED_MEMORY_ROOT,
  "conversations.json",
);

export const STRATEGIC_DOC_PATTERN = /(plan|gameplan|build|strategy|strategic)/i;
export const TEXT_EXTENSIONS = new Set([".md", ".txt"]);
export const MAX_PREVIEW_LENGTH = 600;
