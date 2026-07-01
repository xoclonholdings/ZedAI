import fs from "fs/promises";
import path from "path";
import { generateChatFromOllama } from "../../services/Ollama/OllamaService";
import { webSearch, formatResultsForPrompt, type SearchResponse } from "../../services/WebSearchService";
import {
  fetchWebTargetsFromText,
  formatWebPagesForPrompt,
  hasWebsiteReferenceWithoutTarget,
  type WebFetchResponse,
} from "../../services/WebContentService";
import { storeResearchBrief, querySimilarResearch } from "../../services/ChromaService";
import { REPO_ROOT, HUB_LOG_DIR } from "../../utils/repoPaths";

const SKILL_PATH = path.resolve(REPO_ROOT, "server/agents/intelligence/SKILL.md");
const LOG_DIR = path.resolve(HUB_LOG_DIR, "intelligence");

export interface ResearchRequest {
  userId: string;
  query: string;
  depth?: "shallow" | "deep";
  sources?: string[];
  conversationId?: string;
  memoryContext?: string;
}

export interface ResearchBrief {
  topic: string;
  date: string;
  confidence: "high" | "medium" | "low";
  keyFindings: string[];
  implications: string;
  recommendedAction: string;
  sources: string[];
  agent: "IntelligenceAgent";
}

export class IntelligenceAgent {
  private static skill: string | null = null;

  private static expandKeywords(query: string): string[] {
    const lower = query.toLowerCase();
    const expanded = new Set<string>([query]);

    if (/(stock|equity|shares|ticker)/.test(lower)) {
      expanded.add(`${query} stock analysis`);
      expanded.add(`${query} earnings guidance price target`);
      expanded.add(`${query} institutional sentiment catalysts`);
    }

    if (/(crypto|bitcoin|btc|ethereum|eth|solana|token|defi)/.test(lower)) {
      expanded.add(`${query} crypto market structure`);
      expanded.add(`${query} on-chain catalysts sentiment`);
      expanded.add(`${query} funding rates open interest`);
    }

    if (/(kalshi|prediction market|event contract|event market)/.test(lower)) {
      expanded.add(`${query} kalshi market contract odds`);
      expanded.add(`${query} event market probability drivers`);
      expanded.add(`${query} prediction market catalysts risk factors`);
    }

    if (/(predict|forecast|outlook|scenario|probability)/.test(lower)) {
      expanded.add(`${query} base case bull case bear case`);
      expanded.add(`${query} leading indicators risks catalysts`);
    }

    expanded.add(`${query} latest news`);
    expanded.add(`${query} key risks opportunities`);

    return Array.from(expanded).slice(0, 6);
  }

  static async loadSkill(): Promise<string> {
    if (this.skill) return this.skill;
    try {
      this.skill = await fs.readFile(SKILL_PATH, "utf-8");
    } catch {
      this.skill = "Intelligence Agent: research, analyze, and synthesize information into clear, useful, mobile-readable answers with concrete next steps.";
    }
    return this.skill;
  }

  static async research(request: ResearchRequest): Promise<ResearchBrief> {
    const skill = await this.loadSkill();

    const directWeb = await fetchWebTargetsFromText(request.query);
    const directWebBlock = formatWebPagesForPrompt(directWeb);
    const expandedQueries = this.expandKeywords(request.query);
    const searchResponses = await Promise.all(expandedQueries.map((query) => webSearch(query, 4)));
    const primarySearch = searchResponses[0];
    const searchBlock = searchResponses
      .map((response) => formatResultsForPrompt(response))
      .join("\n\n");

    const noDirectTarget = directWeb.targets.length === 0;
    const noSearchResults = searchResponses.every((response) => response.results.length === 0);
    if (noDirectTarget && noSearchResults && hasWebsiteReferenceWithoutTarget(request.query)) {
      const brief: ResearchBrief = {
        topic: request.query,
        date: new Date().toISOString(),
        confidence: "high",
        keyFindings: [
          "I can visit and read a webpage when a URL is present in the request or recent conversation context.",
          "This request refers to a website, but no specific URL was available to fetch.",
          "I should ask for the URL instead of claiming ZED has no browsing capability.",
        ],
        implications: "ZED needs the exact link before it can verify or summarize that website.",
        recommendedAction: "Send the website URL, then ask me to visit, inspect, summarize, or audit it.",
        sources: [],
        agent: "IntelligenceAgent",
      };
      await this.log(request, brief, expandedQueries, directWeb);
      return brief;
    }

    const priorResearch = await querySimilarResearch(request.query, 2);
    const priorBlock = priorResearch
      ? `\n\n## Prior context from memory\n${priorResearch}`
      : "";
    const memoryBlock = request.memoryContext
      ? `\n\n${request.memoryContext}`
      : "";

    const systemPrompt = `${skill}${memoryBlock}${priorBlock}

## Current request
Query: ${request.query}
Depth: ${request.depth || "shallow"}
User: ${request.userId}

${directWebBlock}

${searchBlock}

Use direct webpage content first when it is available. Search results are secondary. Use supplied project memory when it is relevant. Keep the answer compact and mobile-readable. Do not use tables unless explicitly requested. Never claim that ZED has no browsing or real-time network access when direct webpage content or search context is present. If no URL or source context is available, ask for the exact URL.

Return this internal parse format exactly so the app can render it naturally:
SUBJECT: [short topic]
SOURCE_STRENGTH: [high|medium|low]
POINTS:
- point 1
- point 2
- point 3
MEANING: [what this means for the user]
NEXT_STEP: [specific thing to do next]`.trim();

    const rawReply = await generateChatFromOllama(
      [{ role: "user", content: request.query }],
      systemPrompt,
      { lane: "research" },
    );

    const brief = this.parseBrief(request.query, rawReply, primarySearch, directWeb);

    await storeResearchBrief(brief);
    await this.log(request, brief, expandedQueries, directWeb);

    return brief;
  }

  static async synthesize(documents: string[], topic: string): Promise<string> {
    return generateChatFromOllama(
      [{
        role: "user",
        content: `Synthesize these documents about "${topic}" into a clear, concise answer:\n\n${documents.join("\n\n---\n\n")}`,
      }],
      "Lead with the most important point. Use natural headings only if they help. Avoid report labels, confidence labels, and dense tables.",
      { lane: "research" },
    );
  }

  private static parseBrief(
    query: string,
    raw: string,
    search: SearchResponse,
    directWeb?: WebFetchResponse,
  ): ResearchBrief {
    const lines = raw.split("\n");
    const keyFindings: string[] = [];
    let inFindings = false;
    let implications = "";
    let recommendedAction = "";
    let confidence: "high" | "medium" | "low" = "medium";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("SOURCE_STRENGTH:")) {
        const val = trimmed.split(":")[1]?.trim().toLowerCase();
        if (val === "high" || val === "low") confidence = val;
      } else if (trimmed.startsWith("POINTS:")) {
        inFindings = true;
      } else if (inFindings && trimmed.startsWith("-")) {
        keyFindings.push(trimmed.slice(1).trim());
      } else if (trimmed.startsWith("MEANING:")) {
        inFindings = false;
        implications = trimmed.slice("MEANING:".length).trim();
      } else if (trimmed.startsWith("NEXT_STEP:")) {
        recommendedAction = trimmed.slice("NEXT_STEP:".length).trim();
      } else if (implications && !trimmed.startsWith("NEXT_STEP")) {
        implications += " " + trimmed;
      }
    }

    const directSources = (directWeb?.pages || [])
      .filter((page) => page.url)
      .map((page) => `${page.title || "Fetched webpage"}: ${page.url}`);
    const searchSources = search.results
      .filter((result) => result.title && result.url)
      .slice(0, 4)
      .map((result) => `${result.title}: ${result.url}`);
    const sources = [...directSources, ...searchSources].slice(0, 6);

    return {
      topic: query,
      date: new Date().toISOString(),
      confidence: directSources.length > 0 ? "high" : confidence,
      keyFindings: keyFindings.length > 0 ? keyFindings : [raw.slice(0, 300)],
      implications: implications || "The source context was limited, so this should be treated as a starting point rather than a final answer.",
      recommendedAction: recommendedAction || "Give me one more constraint or target, and I can turn this into a cleaner action plan.",
      sources,
      agent: "IntelligenceAgent",
    };
  }

  private static async log(
    request: ResearchRequest,
    brief: ResearchBrief,
    expandedQueries: string[],
    directWeb?: WebFetchResponse,
  ): Promise<void> {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      const date = new Date().toISOString().split("T")[0];
      const logFile = path.join(LOG_DIR, `${date}.log`);
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: request.userId,
        query: request.query,
        sourceStrength: brief.confidence,
        pointsCount: brief.keyFindings.length,
        sources: brief.sources,
        expandedQueries,
        directWebTargets: directWeb?.targets.map((target) => target.url) || [],
        directWebPages: directWeb?.pages.length || 0,
        directWebErrors: directWeb?.errors || [],
      }) + "\n";
      await fs.appendFile(logFile, entry);
    } catch {}
  }
}
