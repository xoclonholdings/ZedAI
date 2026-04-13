import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { MemoryService } from "./memoryService";
import { addToCollection, queryCollection, type VectorEntry } from "./ChromaService";
import { retrieveFoundationMemory } from "./FoundationMemoryService";
import { HUB_CONFIG_DIR } from "../utils/repoPaths";

type KnowledgeLane =
  | "chat"
  | "manager"
  | "operations"
  | "business"
  | "research"
  | "admin";

type BuildKnowledgeContextParams = {
  userId: string;
  query: string;
  conversationId?: string;
  lane?: KnowledgeLane;
  injectedMemory?: string;
};

export type KnowledgeContext = {
  prompt: string;
  foundation: string;
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
  };
};

type PersistInteractionParams = {
  userId: string;
  conversationId?: string;
  userContent: string;
  assistantContent: string;
  tags?: string[];
};

type KnowledgeSearchResult = {
  foundation: string;
  core: string;
  project: Array<{ id: string; name: string; description: string | null; excerpt: string }>;
  scratchpad: Array<{ id: string; excerpt: string; tags: string[] }>;
  retrieved: Array<{ id: string; source: string; excerpt: string }>;
};

const CORE_PRIORITY_KEYS = [
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

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function extractKeywords(query: string): string[] {
  return Array.from(
    new Set(
      normalizeText(query)
        .split(/\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 3),
    ),
  ).slice(0, 12);
}

function scoreText(text: string, keywords: string[]): number {
  const haystack = normalizeText(text);
  return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
}

function safeExcerpt(text: string, max = 320): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

function parseCoreValue(value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "string") return parsed;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

function formatCoreMemory(entries: Array<{ key: string; value: string }>): string {
  if (entries.length === 0) return "";

  return entries
    .map((entry) => `### ${entry.key}\n${safeExcerpt(parseCoreValue(entry.value), 700)}`)
    .join("\n\n");
}

function formatRetrievedMemory(entries: VectorEntry[]): string {
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

async function loadRulesetMemory(): Promise<Array<{ key: string; value: string }>> {
  const files = ["personality.yaml", "security.yaml", "parameters.yaml", "access.yaml"];
  const results: Array<{ key: string; value: string }> = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(HUB_CONFIG_DIR, file), "utf-8");
      const parsed = yaml.load(content);
      results.push({
        key: file.replace(".yaml", ""),
        value: typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2),
      });
    } catch {}
  }

  return results;
}

export class KnowledgeService {
  static async buildContext(params: BuildKnowledgeContextParams): Promise<KnowledgeContext> {
    const lane = params.lane || "chat";
    const keywords = extractKeywords(params.query);

    await MemoryService.resetScratchpadMemory().catch(() => {});

    const [allCoreMemory, rulesetMemory, allProjectMemory, allScratchpadMemory, episodic, semantic, foundation] =
      await Promise.all([
        MemoryService.getAllCoreMemory(),
        loadRulesetMemory(),
        MemoryService.getProjectMemory(params.userId),
        MemoryService.getScratchpadMemory(params.userId),
        queryCollection("episodic", params.query, 3),
        queryCollection("semantic", params.query, 4),
        retrieveFoundationMemory(params.query),
      ]);

    const relevantCoreMemory = allCoreMemory
      .filter((entry) => CORE_PRIORITY_KEYS.includes(entry.key as (typeof CORE_PRIORITY_KEYS)[number]))
      .sort((a, b) => CORE_PRIORITY_KEYS.indexOf(a.key as (typeof CORE_PRIORITY_KEYS)[number]) - CORE_PRIORITY_KEYS.indexOf(b.key as (typeof CORE_PRIORITY_KEYS)[number]));

    const relevantProjectMemory = allProjectMemory
      .map((entry) => ({
        entry,
        score: scoreText(`${entry.name} ${entry.description || ""} ${entry.content}`, keywords),
      }))
      .filter((item) => item.score > 0 || keywords.length === 0)
      .sort((a, b) => b.score - a.score || Number(new Date(b.entry.updatedAt)) - Number(new Date(a.entry.updatedAt)))
      .slice(0, 4)
      .map((item) => item.entry);

    const relevantScratchpad = allScratchpadMemory
      .filter((entry) => !params.conversationId || !entry.conversationId || entry.conversationId === params.conversationId)
      .map((entry) => ({
        entry,
        score: scoreText(`${entry.content} ${(entry.tags || []).join(" ")}`, keywords),
      }))
      .filter((item) => item.score > 0 || item.entry.conversationId === params.conversationId)
      .sort((a, b) => b.score - a.score || Number(new Date(b.entry.createdAt)) - Number(new Date(a.entry.createdAt)))
      .slice(0, 5)
      .map((item) => item.entry);

    const retrievedEntries = [...episodic, ...semantic].slice(0, 5);

    const coreBlock = formatCoreMemory(
      relevantCoreMemory.map((entry) => ({ key: entry.key, value: entry.value })),
    );
    const rulesetBlock = formatCoreMemory(rulesetMemory);

    const projectBlock =
      relevantProjectMemory.length > 0
        ? relevantProjectMemory
            .map(
              (entry) =>
                `### ${entry.name}\nType: ${entry.type}\n${entry.description ? `Description: ${entry.description}\n` : ""}${safeExcerpt(entry.content, 700)}`,
            )
            .join("\n\n")
        : "";

    const scratchpadBlock =
      relevantScratchpad.length > 0
        ? relevantScratchpad
            .map(
              (entry, index) =>
                `### Working Memory ${index + 1}${entry.tags?.length ? ` [${entry.tags.join(", ")}]` : ""}\n${safeExcerpt(entry.content, 320)}`,
            )
            .join("\n\n")
        : "";

    const retrievedBlock = formatRetrievedMemory(retrievedEntries);

    const sections = [
      params.injectedMemory ? `## Hub Memory\n${params.injectedMemory}` : "",
      coreBlock ? `## Core Knowledge (${lane})\n${coreBlock}` : "",
      rulesetBlock ? `## Active Ruleset\n${rulesetBlock}` : "",
      foundation ? `## Foundation Knowledge\n${foundation}` : "",
      projectBlock ? `## Project Knowledge\n${projectBlock}` : "",
      scratchpadBlock ? `## Working Scratchpad\n${scratchpadBlock}` : "",
      retrievedBlock ? `## Retrieved Semantic / Episodic Memory\n${retrievedBlock}` : "",
    ].filter(Boolean);

    return {
      prompt: sections.join("\n\n"),
      foundation,
      core: coreBlock,
      ruleset: rulesetBlock,
      project: projectBlock,
      scratchpad: scratchpadBlock,
      retrieved: retrievedBlock,
      counts: {
        core: relevantCoreMemory.length,
        ruleset: rulesetMemory.length,
        project: relevantProjectMemory.length,
        scratchpad: relevantScratchpad.length,
        retrieved: retrievedEntries.length,
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
      core: [context.core, context.ruleset].filter(Boolean).join("\n\n"),
      project: projectMemory
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          description: entry.description || null,
          excerpt: safeExcerpt(entry.content, 220),
          score: scoreText(`${entry.name} ${entry.description || ""} ${entry.content}`, keywords),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ score: _score, ...entry }) => entry),
      scratchpad: scratchpadMemory
        .filter((entry) => !params.conversationId || !entry.conversationId || entry.conversationId === params.conversationId)
        .map((entry) => ({
          id: entry.id,
          excerpt: safeExcerpt(entry.content, 220),
          tags: entry.tags || [],
          score: scoreText(`${entry.content} ${(entry.tags || []).join(" ")}`, keywords),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ score: _score, ...entry }) => entry),
      retrieved: retrievedEntries.map((entry) => ({
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
