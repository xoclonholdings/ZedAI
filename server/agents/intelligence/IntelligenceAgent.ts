import fs from "fs/promises";
import path from "path";
import { generateChatFromOllama } from "../../services/Ollama/OllamaService";
import { webSearch, formatResultsForPrompt } from "../../services/WebSearchService";
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
      this.skill = "Intelligence Agent: Research, analyze, and synthesize information. Produce structured briefs with findings, confidence levels, and actionable recommendations.";
    }
    return this.skill;
  }

  static async research(request: ResearchRequest): Promise<ResearchBrief> {
    const skill = await this.loadSkill();

    const expandedQueries = this.expandKeywords(request.query);
    const searchResponses = await Promise.all(expandedQueries.map((query) => webSearch(query, 4)));
    const primarySearch = searchResponses[0];
    const searchBlock = searchResponses
      .map((response) => formatResultsForPrompt(response))
      .join("\n\n");

    const priorResearch = await querySimilarResearch(request.query, 2);
    const priorBlock = priorResearch
      ? `\n\n## Prior Research (from semantic memory)\n${priorResearch}`
      : "";
    const memoryBlock = request.memoryContext
      ? `\n\n${request.memoryContext}`
      : "";

    const systemPrompt = `${skill}${memoryBlock}${priorBlock}

## Current Research Task
Query: ${request.query}
Depth: ${request.depth || "shallow"}
User: ${request.userId}

${searchBlock}

When supplied knowledge context contains foundation, project, or retrieved memory, use it directly and reference it in the findings instead of ignoring it.

Always produce output in this exact format:
BRIEF: [topic summary]
CONFIDENCE: [high|medium|low]
KEY_FINDINGS:
- finding 1
- finding 2
- finding 3
IMPLICATIONS: [what this means for the user]
RECOMMENDED_ACTION: [what to do next]`.trim();

    const rawReply = await generateChatFromOllama(
      [{ role: "user", content: request.query }],
      systemPrompt
    );

    const brief = this.parseBrief(request.query, rawReply, primarySearch.source);
    brief.sources.push(`Expanded keyword search: ${expandedQueries.join(" | ")}`);

    await storeResearchBrief(brief);
    await this.log(request, brief);

    return brief;
  }

  static async synthesize(documents: string[], topic: string): Promise<string> {
    return generateChatFromOllama(
      [{
        role: "user",
        content: `Synthesize the following documents about "${topic}" into a concise research brief:\n\n${documents.join("\n\n---\n\n")}`,
      }],
      "You are a research synthesis expert. Be analytical, cite sources, flag speculation. Lead with the most important finding."
    );
  }

  private static parseBrief(query: string, raw: string, searchSource: string): ResearchBrief {
    const lines = raw.split("\n");
    const keyFindings: string[] = [];
    let inFindings = false;
    let implications = "";
    let recommendedAction = "";
    let confidence: "high" | "medium" | "low" = "medium";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("CONFIDENCE:")) {
        const val = trimmed.split(":")[1]?.trim().toLowerCase();
        if (val === "high" || val === "low") confidence = val;
      } else if (trimmed.startsWith("KEY_FINDINGS:")) {
        inFindings = true;
      } else if (inFindings && trimmed.startsWith("-")) {
        keyFindings.push(trimmed.slice(1).trim());
      } else if (trimmed.startsWith("IMPLICATIONS:")) {
        inFindings = false;
        implications = trimmed.slice("IMPLICATIONS:".length).trim();
      } else if (trimmed.startsWith("RECOMMENDED_ACTION:")) {
        recommendedAction = trimmed.slice("RECOMMENDED_ACTION:".length).trim();
      } else if (implications && !trimmed.startsWith("RECOMMENDED_ACTION")) {
        implications += " " + trimmed;
      }
    }

    const sources: string[] = [];
    if (searchSource !== "none") sources.push(`Web search via ${searchSource}`);
    sources.push("Ollama local model synthesis");

    return {
      topic: query,
      date: new Date().toISOString(),
      confidence,
      keyFindings: keyFindings.length > 0 ? keyFindings : [raw.slice(0, 300)],
      implications: implications || "See full response for details.",
      recommendedAction: recommendedAction || "Review findings and determine next steps.",
      sources,
      agent: "IntelligenceAgent",
    };
  }

  private static async log(request: ResearchRequest, brief: ResearchBrief): Promise<void> {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      const date = new Date().toISOString().split("T")[0];
      const logFile = path.join(LOG_DIR, `${date}.log`);
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: request.userId,
        query: request.query,
        confidence: brief.confidence,
        findingsCount: brief.keyFindings.length,
        sources: brief.sources,
      }) + "\n";
      await fs.appendFile(logFile, entry);
    } catch {}
  }
}
