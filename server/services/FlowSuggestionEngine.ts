import { createHash } from "crypto";

import { FlowStore } from "./FlowStore";
import { FlowSuggestionStore } from "./FlowSuggestionStore";
import { gatherUserRequestCandidates, type UserRequestCandidate } from "./UserRequestSignals";
import type { FlowCategory, FlowDefinition } from "../../shared/flow-types";

/**
 * Notices repeated user requests - the same kind of ask showing up across
 * chat messages and manually-launched flow briefs - and turns each
 * sufficiently-repeated pattern into a suggestion to save as a real Flow
 * (a "shortcut"). No embeddings/ML model: patterns are grouped by token
 * (word) overlap, which is cheap, deterministic, and good enough at the
 * scale of one person's own request history.
 *
 * Nothing is stored as a suggestion queue - every call recomputes fresh
 * from the user's actual conversations and flow runs, so it always reflects
 * current behavior. FlowSuggestionStore only remembers dismissals.
 */

const MIN_OCCURRENCES = 3;
const RECENCY_WINDOW_MS = 45 * 24 * 60 * 60 * 1000; // 45 days
const CLUSTER_SIMILARITY_THRESHOLD = 0.5;
const EXISTING_FLOW_OVERLAP_THRESHOLD = 0.45;
const MAX_SUGGESTIONS = 5;

const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "for", "and", "or", "in", "on", "at", "is", "are", "was",
  "were", "be", "been", "i", "you", "your", "my", "me", "it", "its", "this", "that", "with",
  "please", "can", "could", "would", "should", "do", "does", "did", "just", "need", "want",
  "help", "zar", "zar", "me", "us", "we", "about", "into", "up", "out", "so", "how", "what",
  "when", "if", "then", "than", "as", "by", "from", "some", "any", "all",
]);

interface Cluster {
  tokens: Set<string>;
  representative: string;
  examples: string[];
  occurrences: number;
  firstSeenAt: number;
  lastSeenAt: number;
  chatCount: number;
  runCount: number;
}

export interface FlowSuggestion {
  id: string;
  suggestedName: string;
  suggestedBlurb: string;
  suggestedCategory: FlowCategory;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  examples: string[];
  fromChat: number;
  fromRuns: number;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function clusterCandidates(candidates: UserRequestCandidate[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const candidate of candidates) {
    const tokens = tokenize(candidate.text);
    if (tokens.size < 3) continue;

    let best: Cluster | undefined;
    let bestScore = 0;
    for (const cluster of clusters) {
      const score = jaccard(tokens, cluster.tokens);
      if (score > bestScore) {
        bestScore = score;
        best = cluster;
      }
    }

    if (best && bestScore >= CLUSTER_SIMILARITY_THRESHOLD) {
      best.occurrences += 1;
      best.lastSeenAt = Math.max(best.lastSeenAt, candidate.at);
      best.firstSeenAt = Math.min(best.firstSeenAt, candidate.at);
      if (candidate.source === "chat") best.chatCount += 1;
      else best.runCount += 1;
      if (best.examples.length < 5 && !best.examples.includes(candidate.text)) {
        best.examples.push(candidate.text);
      }
    } else {
      clusters.push({
        tokens,
        representative: candidate.text,
        examples: [candidate.text],
        occurrences: 1,
        firstSeenAt: candidate.at,
        lastSeenAt: candidate.at,
        chatCount: candidate.source === "chat" ? 1 : 0,
        runCount: candidate.source === "run" ? 1 : 0,
      });
    }
  }
  return clusters;
}

function titleCase(text: string, maxWords = 7): string {
  const words = text.trim().split(/\s+/).slice(0, maxWords);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function suggestionIdFor(tokens: Set<string>): string {
  const key = Array.from(tokens).sort().join(",");
  return createHash("sha1").update(key).digest("hex").slice(0, 16);
}


export async function computeFlowSuggestions(userId: string): Promise<FlowSuggestion[]> {
  const [candidates, dismissed, existingFlows] = await Promise.all([
    gatherUserRequestCandidates(userId),
    FlowSuggestionStore.getDismissed(userId),
    FlowStore.listPublished().catch(() => [] as FlowDefinition[]),
  ]);

  const existingFlowTokens = existingFlows.map((flow) =>
    tokenize(`${flow.userFacingLabel} ${flow.userFacingBlurb} ${flow.description || ""}`),
  );

  const now = Date.now();
  const clusters = clusterCandidates(candidates)
    .filter((cluster) => cluster.occurrences >= MIN_OCCURRENCES)
    .filter((cluster) => now - cluster.lastSeenAt <= RECENCY_WINDOW_MS)
    .filter((cluster) => !existingFlowTokens.some((flowTokens) => jaccard(cluster.tokens, flowTokens) >= EXISTING_FLOW_OVERLAP_THRESHOLD))
    .sort((a, b) => b.occurrences - a.occurrences);

  const suggestions: FlowSuggestion[] = [];
  for (const cluster of clusters) {
    const id = suggestionIdFor(cluster.tokens);
    if (dismissed.has(id)) continue;
    suggestions.push({
      id,
      suggestedName: titleCase(cluster.representative),
      suggestedBlurb: cluster.representative.length > 160
        ? `${cluster.representative.slice(0, 157)}...`
        : cluster.representative,
      suggestedCategory: "custom",
      occurrences: cluster.occurrences,
      firstSeenAt: new Date(cluster.firstSeenAt).toISOString(),
      lastSeenAt: new Date(cluster.lastSeenAt).toISOString(),
      examples: cluster.examples,
      fromChat: cluster.chatCount,
      fromRuns: cluster.runCount,
    });
    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }

  return suggestions;
}

export async function acceptFlowSuggestion(
  userId: string,
  suggestionId: string,
  overrides: { name?: string; category?: FlowCategory; blurb?: string },
): Promise<FlowDefinition> {
  const suggestions = await computeFlowSuggestions(userId);
  const suggestion = suggestions.find((entry) => entry.id === suggestionId);
  if (!suggestion) {
    throw new Error("That suggestion is no longer available - it may have already been added or has fewer recent matches now.");
  }

  const name = overrides.name?.trim() || suggestion.suggestedName;
  const blurb = overrides.blurb?.trim() || suggestion.suggestedBlurb;
  const category = overrides.category || suggestion.suggestedCategory;
  const brief = suggestion.examples[0] || suggestion.suggestedBlurb;

  const draft = await FlowStore.createDefinition({
    name,
    category,
    description: `A shortcut ZAR noticed from ${suggestion.occurrences} similar requests: "${brief}"`,
    purpose: brief,
    status: "draft",
    version: 1,
    agents: ["manager"],
    triggerConditions: [],
    stages: [
      {
        id: "run",
        order: 0,
        name: "Run this shortcut",
        description: "Fulfill the saved request the same way ZAR handled it before.",
        assignedAgent: "manager",
        requiresApproval: false,
        steps: [
          {
            id: "step-1",
            order: 0,
            label: "Fulfill the saved request",
            detail: brief,
          },
        ],
      },
    ],
    userFacingLabel: name,
    userFacingBlurb: blurb,
  });

  return (await FlowStore.publishDefinition(draft.id)) || draft;
}

export async function dismissFlowSuggestion(userId: string, suggestionId: string): Promise<void> {
  await FlowSuggestionStore.dismiss(userId, suggestionId);
}
