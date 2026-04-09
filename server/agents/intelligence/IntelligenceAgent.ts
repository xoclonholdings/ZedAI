import fs from "fs/promises";
import path from "path";
import { generateFromOllama } from "../../services/Ollama/OllamaService";
import { buildOllamaPrompt } from "../../services/Ollama/OllamaContextBuilder";

const CWD = process.cwd();
const SKILL_PATH = path.resolve(CWD, "agents/intelligence/SKILL.md");
const SEMANTIC_DIR = path.resolve(CWD, "hub/shared-memory/semantic");
const LOG_DIR = path.resolve(CWD, "hub/logs/intelligence");

export interface ResearchRequest {
  userId: string;
  query: string;
  depth?: "shallow" | "deep";
  sources?: string[];
  conversationId?: string;
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

  static async loadSkill(): Promise<string> {
    if (this.skill) return this.skill;
    try {
      this.skill = await fs.readFile(SKILL_PATH, "utf-8");
    } catch {
      this.skill = "Intelligence Agent: Research, analyze, and synthesize information.";
    }
    return this.skill;
  }

  static async research(request: ResearchRequest): Promise<ResearchBrief> {
    const skill = await this.loadSkill();

    const systemContext = `
${skill}

## Research Task
Query: ${request.query}
Depth: ${request.depth || "shallow"}
User: ${request.userId}

Always produce output in this exact format:
BRIEF: [topic]
CONFIDENCE: [high|medium|low]
KEY_FINDINGS:
- finding 1
- finding 2
IMPLICATIONS: [what this means]
RECOMMENDED_ACTION: [what to do with this]
    `.trim();

    const prompt = buildOllamaPrompt(request.query, {
      systemPrompt: systemContext,
    });

    const rawReply = await generateFromOllama(prompt);
    const brief = this.parseBrief(request.query, rawReply);

    await this.storeToSemantic(brief);
    await this.log(request, brief);

    return brief;
  }

  static async synthesize(documents: string[], topic: string): Promise<string> {
    const prompt = buildOllamaPrompt(
      `Synthesize the following documents about "${topic}" into a concise research brief:\n\n${documents.join("\n\n---\n\n")}`,
      {
        systemPrompt: "You are a research synthesis expert. Be analytical, cite sources, flag speculation.",
      }
    );
    return generateFromOllama(prompt);
  }

  private static parseBrief(query: string, raw: string): ResearchBrief {
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

    return {
      topic: query,
      date: new Date().toISOString(),
      confidence,
      keyFindings: keyFindings.length > 0 ? keyFindings : [raw.slice(0, 300)],
      implications: implications || "See full response for details.",
      recommendedAction: recommendedAction || "Review findings and determine next steps.",
      sources: ["Ollama local model synthesis"],
      agent: "IntelligenceAgent",
    };
  }

  private static async storeToSemantic(brief: ResearchBrief): Promise<void> {
    try {
      await fs.mkdir(SEMANTIC_DIR, { recursive: true });
      const filename = `research-${Date.now()}.json`;
      await fs.writeFile(
        path.join(SEMANTIC_DIR, filename),
        JSON.stringify(brief, null, 2)
      );
    } catch (err) {
      console.warn("[IntelligenceAgent] Semantic store write failed:", err);
    }
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
      }) + "\n";
      await fs.appendFile(logFile, entry);
    } catch {}
  }
}
