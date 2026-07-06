import { MemoryService } from "./memoryService";
import { addToCollection, queryCollection } from "./ChromaService";
import { retrieveFoundationMemoryWithTrace } from "./FoundationMemoryService";
import { retrievePersonalizationForQuery } from "./UserPersonalizationCorpus";

import {
  dedupeRetrievedMemory,
  formatCoreMemory,
  formatRetrievedMemory,
} from "./knowledge-service/formatting";
import {
  extractKeywords,
  safeExcerpt,
  scoreProjectMemory,
  scoreScratchpadMemory,
} from "./knowledge-service/scoring";
import { loadRulesetMemory } from "./knowledge-service/sources";
import {
  CORE_PRIORITY_KEYS,
  LANE_DIRECTIVES,
  PERSONAL_MEMORY_TYPES,
  type BuildKnowledgeContextParams,
  type KnowledgeContext,
  type KnowledgeSearchResult,
  type PersistInteractionParams,
} from "./knowledge-service/types";

export type { KnowledgeContext } from "./knowledge-service/types";

/**
 * Knowledge orchestration — pulls together core memory, ruleset
 * YAMLs, foundation knowledge, project memory, scratchpad, and
 * vector-store retrieval into a single per-lane system-prompt
 * fragment.
 *
 * Helpers live under ./knowledge-service/:
 *   types.ts       request/response shapes + CORE_PRIORITY_KEYS,
 *                  PERSONAL_MEMORY_TYPES, LANE_DIRECTIVES
 *   scoring.ts     extractKeywords + per-source scoring
 *   formatting.ts  parseCoreValue + format* + dedupeRetrievedMemory
 *   sources.ts     loadRulesetMemory (reads the four YAMLs)
 */
export class KnowledgeService {
  static async buildContext(params: BuildKnowledgeContextParams): Promise<KnowledgeContext> {
    const lane = params.lane || "chat";
    const keywords = extractKeywords(params.query);
    const includeAdminKnowledge = params.includeAdminFoundation === true;

    // Trim expired scratchpad entries before reading — best-effort,
    // failures here just mean we read a slightly larger working set.
    await MemoryService.resetScratchpadMemory().catch(() => {
      /* see comment above */
    });

    const [
      allCoreMemory,
      rulesetMemory,
      allProjectMemory,
      allScratchpadMemory,
      episodic,
      semantic,
      foundationResult,
      personalizationResult,
    ] = await Promise.all([
      MemoryService.getAllCoreMemory(),
      loadRulesetMemory(),
      MemoryService.getProjectMemory(params.userId),
      MemoryService.getScratchpadMemory(params.userId),
      queryCollection("episodic", params.query, 3),
      queryCollection("semantic", params.query, 4),
      retrieveFoundationMemoryWithTrace(params.query, {
        enabled: params.includeAdminFoundation === true,
      }),
      retrievePersonalizationForQuery(params.userId, params.query, 3),
    ]);
    const foundation = foundationResult.content;
    const foundationTrace = foundationResult.trace;
    const personalization = personalizationResult.block;

    // Keep only the priority keys, ordered as declared in CORE_PRIORITY_KEYS.
    const relevantCoreMemory = allCoreMemory
      .filter((entry) => includeAdminKnowledge || entry.adminOnly === false)
      .filter((entry) =>
        CORE_PRIORITY_KEYS.includes(entry.key as (typeof CORE_PRIORITY_KEYS)[number]),
      )
      .sort(
        (a, b) =>
          CORE_PRIORITY_KEYS.indexOf(a.key as (typeof CORE_PRIORITY_KEYS)[number]) -
          CORE_PRIORITY_KEYS.indexOf(b.key as (typeof CORE_PRIORITY_KEYS)[number]),
      );

    // Personal-type project memory is always included (capped at 3),
    // independent of keyword score — these are the "always-on" facts
    // about the user.
    const personalProjectMemory = allProjectMemory
      .filter(
        (entry) =>
          PERSONAL_MEMORY_TYPES.has((entry.type || "").toLowerCase()) &&
          entry.isActive !== false,
      )
      .slice(0, 3);

    const relevantProjectMemory = allProjectMemory
      .map((entry) => ({
        entry,
        score: scoreProjectMemory(entry, keywords),
      }))
      .filter((item) => item.score > 0 || keywords.length === 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Number(new Date(b.entry.updatedAt)) - Number(new Date(a.entry.updatedAt)),
      )
      .slice(0, 4)
      .map((item) => item.entry);

    const mergedProjectMemory = Array.from(
      new Map(
        [...personalProjectMemory, ...relevantProjectMemory].map((entry) => [entry.id, entry]),
      ).values(),
    ).slice(0, 5);

    const relevantScratchpad = allScratchpadMemory
      .filter(
        (entry) =>
          !params.conversationId ||
          !entry.conversationId ||
          entry.conversationId === params.conversationId,
      )
      .map((entry) => ({
        entry,
        score: scoreScratchpadMemory(entry, keywords, params.conversationId),
      }))
      .filter(
        (item) => item.score > 0 || item.entry.conversationId === params.conversationId,
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          Number(new Date(b.entry.createdAt)) - Number(new Date(a.entry.createdAt)),
      )
      .slice(0, 5)
      .map((item) => item.entry);

    const retrievedEntries = dedupeRetrievedMemory([...episodic, ...semantic]).slice(0, 5);

    const coreBlock = formatCoreMemory(
      relevantCoreMemory.map((entry) => ({ key: entry.key, value: entry.value })),
    );
    const rulesetBlock = includeAdminKnowledge ? formatCoreMemory(rulesetMemory) : "";

    const projectBlock =
      mergedProjectMemory.length > 0
        ? mergedProjectMemory
            .map(
              (entry) =>
                `### ${entry.name}\nType: ${entry.type}\n${
                  entry.description ? `Description: ${entry.description}\n` : ""
                }${safeExcerpt(entry.content, 700)}`,
            )
            .join("\n\n")
        : "";

    const scratchpadBlock =
      relevantScratchpad.length > 0
        ? relevantScratchpad
            .map(
              (entry, index) =>
                `### Working Memory ${index + 1}${
                  entry.tags?.length ? ` [${entry.tags.join(", ")}]` : ""
                }\n${safeExcerpt(entry.content, 320)}`,
            )
            .join("\n\n")
        : "";

    const retrievedBlock = formatRetrievedMemory(retrievedEntries);

    const sections = [
      `## Knowledge Use Policy\n${LANE_DIRECTIVES[lane]}`,
      params.injectedMemory ? `## Hub Memory\n${params.injectedMemory}` : "",
      coreBlock ? `## Core Knowledge (${lane})\n${coreBlock}` : "",
      rulesetBlock ? `## Active Ruleset\n${rulesetBlock}` : "",
      foundation ? `## Foundation Knowledge\n${foundation}` : "",
      personalization,
      projectBlock ? `## Project Knowledge\n${projectBlock}` : "",
      scratchpadBlock ? `## Working Scratchpad\n${scratchpadBlock}` : "",
      retrievedBlock ? `## Retrieved Semantic / Episodic Memory\n${retrievedBlock}` : "",
    ].filter(Boolean);

    return {
      prompt: sections.join("\n\n"),
      foundation,
      foundationTrace,
      personalization,
      personalizationTrace: personalizationResult.trace,
      core: coreBlock,
      ruleset: rulesetBlock,
      project: projectBlock,
      scratchpad: scratchpadBlock,
      retrieved: retrievedBlock,
      counts: {
        core: relevantCoreMemory.length,
        ruleset: rulesetMemory.length,
        project: mergedProjectMemory.length,
        scratchpad: relevantScratchpad.length,
        retrieved: retrievedEntries.length,
        personalization: personalizationResult.trace.length,
      },
    };
  }

  static async search(params: {
    userId: string;
    query: string;
    conversationId?: string;
  }): Promise<KnowledgeSearchResult> {
    const context = await this.buildContext({
      userId: params.userId,
      query: params.query,
      conversationId: params.conversationId,
      lane: "admin",
    });

    const projectMemory = await MemoryService.getProjectMemory(params.userId);
    const scratchpadMemory = await MemoryService.getScratchpadMemory(params.userId);
    const retrievedEntries = await Promise.all([
      queryCollection("episodic", params.query, 3),
      queryCollection("semantic", params.query, 3),
    ]).then(([episodic, semantic]) => [...episodic, ...semantic]);

    const keywords = extractKeywords(params.query);

    return {
      foundation: context.foundation,
      foundationTrace: context.foundationTrace,
      core: [context.core, context.ruleset].filter(Boolean).join("\n\n"),
      project: projectMemory
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          description: entry.description || null,
          excerpt: safeExcerpt(entry.content, 220),
          score: scoreProjectMemory(entry, keywords),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ score: _score, ...entry }) => entry),
      scratchpad: scratchpadMemory
        .filter(
          (entry) =>
            !params.conversationId ||
            !entry.conversationId ||
            entry.conversationId === params.conversationId,
        )
        .map((entry) => ({
          id: entry.id,
          excerpt: safeExcerpt(entry.content, 220),
          tags: entry.tags || [],
          score: scoreScratchpadMemory(entry, keywords, params.conversationId),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ score: _score, ...entry }) => entry),
      retrieved: dedupeRetrievedMemory(retrievedEntries).map((entry) => ({
        id: entry.id,
        source:
          typeof entry.metadata?.topic === "string"
            ? "semantic"
            : typeof entry.metadata?.conversationId === "string"
              ? "episodic"
              : "memory",
        excerpt: safeExcerpt(entry.document, 220),
      })),
    };
  }

  /**
   * Save a user/assistant turn into the vector stores (episodic +
   * semantic) and a short scratchpad note. Uses `Promise.allSettled`
   * because losing one store shouldn't block the others — partial
   * persistence is better than none.
   */
  static async persistInteraction(params: PersistInteractionParams): Promise<void> {
    const timestamp = new Date().toISOString();
    const document = `User: ${params.userContent}\nAssistant: ${params.assistantContent}`;
    const metadata = {
      conversationId: params.conversationId || "none",
      userId: params.userId,
      savedAt: timestamp,
      tags: (params.tags || []).join(","),
    };

    await Promise.allSettled([
      addToCollection("episodic", {
        id: `episodic-${params.conversationId || params.userId}-${Date.now()}`,
        document,
        metadata,
      }),
      addToCollection("semantic", {
        id: `semantic-${params.conversationId || params.userId}-${Date.now()}`,
        document,
        metadata,
      }),
      MemoryService.createScratchpadMemory({
        userId: params.userId,
        conversationId: params.conversationId || null,
        content: safeExcerpt(document, 500),
        tags: (params.tags || []).slice(0, 8),
      }),
    ]);
  }
}
