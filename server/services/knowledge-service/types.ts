import type { FoundationTraceItem } from "../FoundationMemoryService";
import type { PersonalizationRetrievalTraceItem } from "../UserPersonalizationCorpus";

export type KnowledgeLane =
  | "chat"
  | "manager"
  | "operations"
  | "business"
  | "research"
  | "admin";

export type BuildKnowledgeContextParams = {
  userId: string;
  query: string;
  conversationId?: string;
  lane?: KnowledgeLane;
  injectedMemory?: string;
  includeAdminFoundation?: boolean;
};

export type KnowledgeContext = {
  prompt: string;
  foundation: string;
  foundationTrace: FoundationTraceItem[];
  personalization: string;
  personalizationTrace: PersonalizationRetrievalTraceItem[];
  core: string;
  ruleset: string;
  project: string;
  scratchpad: string;
  retrieved: string;
  counts: {
    core: number;
    ruleset: number;
    project: number;
    scratchpad: number;
    retrieved: number;
    personalization: number;
  };
};

export type PersistInteractionParams = {
  userId: string;
  conversationId?: string;
  userContent: string;
  assistantContent: string;
  tags?: string[];
};

export type KnowledgeSearchResult = {
  foundation: string;
  foundationTrace: FoundationTraceItem[];
  core: string;
  project: Array<{
    id: string;
    name: string;
    description: string | null;
    excerpt: string;
  }>;
  scratchpad: Array<{ id: string; excerpt: string; tags: string[] }>;
  retrieved: Array<{ id: string; source: string; excerpt: string }>;
};

/**
 * The subset of core-memory entries that we surface in the
 * system-prompt block, in the order we want them. Other entries
 * (e.g. internal flags) stay in the DB but don't get prompted.
 */
export const CORE_PRIORITY_KEYS = [
  "foundation_profile",
  "identity",
  "tone",
  "operation",
  "modes",
  "memory_policy",
  "instruction_model",
  "tool_policy",
  "risk_model",
  "rules",
  "default_context",
] as const;

/**
 * Project-memory entries with one of these `type` values are
 * treated as "personal foundation" and always included in the
 * prompt regardless of keyword score.
 */
export const PERSONAL_MEMORY_TYPES = new Set([
  "profile",
  "identity",
  "preferences",
  "goals",
]);

/**
 * Per-lane preamble appended to the knowledge prompt. Each lane gets
 * a one-paragraph directive about how to USE the supplied knowledge
 * — not what to do (that's the system prompt's job) but how to
 * weigh the context blocks below it.
 */
export const LANE_DIRECTIVES: Record<KnowledgeLane, string> = {
  chat:
    "Answer as ZED using the supplied knowledge context first. Prefer specific, decisive answers over generic filler. Do not ask the user to repeat information already present in memory unless it is conflicting or missing a critical detail.",
  manager:
    "Use the shared knowledge stack to route intelligently. Favor the lane that best matches the goal and the known business context. Do not over-route into generic research if the knowledge context already provides the answer.",
  operations:
    "Prefer execution-ready outputs that reflect known brand, operating rules, and prior decisions. Use the knowledge context directly when it contains the sender identity, project context, or operating preferences.",
  business:
    "Ground strategy in the known business foundation, project memory, and rules before generating new recommendations. Avoid boilerplate when the venture or goals are already known.",
  research:
    "Use internal foundation and project knowledge as the baseline, then layer retrieved or searched evidence on top. If internal knowledge conflicts with external signals, say so clearly.",
  admin:
    "Summarize the knowledge system faithfully and prefer direct excerpts over speculation.",
};
