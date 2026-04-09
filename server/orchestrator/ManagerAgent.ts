import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { OperationsAgent, type AgentRequest, type AgentResponse } from "../agents/operations/OperationsAgent";
import { IntelligenceAgent, type ResearchRequest } from "../agents/intelligence/IntelligenceAgent";
import { IDEOperatorAgent } from "../agents/ide-operator/IDEOperatorAgent";
import { AudioEngineerAgent } from "../agents/audio-engineer/AudioEngineerAgent";

const CONFIG_DIR = path.resolve(process.cwd(), "hub/config");
const LOG_DIR = path.resolve(process.cwd(), "hub/logs");

interface HubConfig {
  personality: any;
  security: any;
  parameters: any;
  access: any;
}

interface OrchestratorRequest {
  userId: string;
  message: string;
  conversationId?: string;
  context?: Record<string, any>;
}

interface OrchestratorResponse {
  reply: string;
  agent: string;
  requiresApproval?: boolean;
  pendingApproval?: string;
  metadata?: Record<string, any>;
}

type AgentName = "OperationsAgent" | "IntelligenceAgent" | "IDEOperatorAgent" | "AudioEngineerAgent";

export class ManagerAgent {
  private static config: HubConfig | null = null;

  static async loadConfig(): Promise<HubConfig> {
    if (this.config) return this.config;

    const loadYaml = async (filename: string) => {
      try {
        const raw = await fs.readFile(path.join(CONFIG_DIR, filename), "utf-8");
        return yaml.load(raw) as any;
      } catch {
        console.warn(`[ManagerAgent] Could not load ${filename}, using defaults`);
        return {};
      }
    };

    this.config = {
      personality: await loadYaml("personality.yaml"),
      security: await loadYaml("security.yaml"),
      parameters: await loadYaml("parameters.yaml"),
      access: await loadYaml("access.yaml"),
    };

    return this.config;
  }

  static async route(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const config = await this.loadConfig();
    const agent = this.selectAgent(request.message, config);

    console.log(`[ManagerAgent] Routing to ${agent} for user ${request.userId}`);
    await this.logRouting(request, agent);

    switch (agent) {
      case "IntelligenceAgent": {
        const researchReq: ResearchRequest = {
          userId: request.userId,
          query: request.message,
          depth: request.message.length > 100 ? "deep" : "shallow",
          conversationId: request.conversationId,
        };
        const brief = await IntelligenceAgent.research(researchReq);
        return {
          reply: this.formatBrief(brief),
          agent: "IntelligenceAgent",
          metadata: { brief },
        };
      }

      case "IDEOperatorAgent": {
        if (!IDEOperatorAgent.isActive()) {
          return {
            reply: "The IDE Operator Agent is not yet active. It requires ADMIN setup. Check agents/ide-operator/SKILL.md.",
            agent: "IDEOperatorAgent",
          };
        }
        const resp = await IDEOperatorAgent.process({
          userId: request.userId,
          task: request.message,
        });
        return { reply: resp.message, agent: resp.agent };
      }

      case "AudioEngineerAgent": {
        if (!AudioEngineerAgent.isActive()) {
          return {
            reply: "The Audio Engineer Agent is not yet active. It requires DAW setup. Check agents/audio-engineer/SKILL.md.",
            agent: "AudioEngineerAgent",
          };
        }
        const resp = await AudioEngineerAgent.process({
          userId: request.userId,
          task: request.message,
        });
        return { reply: resp.message, agent: resp.agent };
      }

      case "OperationsAgent":
      default: {
        const opReq: AgentRequest = {
          userId: request.userId,
          message: request.message,
          conversationId: request.conversationId,
          context: request.context,
        };
        const opResp: AgentResponse = await OperationsAgent.process(opReq);
        return {
          reply: opResp.reply,
          agent: "OperationsAgent",
          requiresApproval: opResp.requiresApproval,
          metadata: { actions: opResp.actions },
        };
      }
    }
  }

  private static selectAgent(message: string, config: HubConfig): AgentName {
    const lower = message.toLowerCase();
    const params = config.parameters || {};

    const researchKeywords: string[] = params.agent_routing?.research_keywords || [
      "research", "find", "analyze", "trend", "market", "github", "news",
      "what is", "how does", "who is", "explain", "summarize",
    ];

    const ideKeywords = ["code", "debug", "refactor", "pull request", "pr", "commit", "repository", "bug fix"];
    const audioKeywords = ["mix", "master", "daw", "track", "stem", "production", "music", "audio", "beat"];

    if (ideKeywords.some((k) => lower.includes(k))) return "IDEOperatorAgent";
    if (audioKeywords.some((k) => lower.includes(k))) return "AudioEngineerAgent";
    if (researchKeywords.some((k) => lower.includes(k))) return "IntelligenceAgent";

    return "OperationsAgent";
  }

  private static formatBrief(brief: any): string {
    const findings = brief.keyFindings.map((f: string) => `• ${f}`).join("\n");
    return `**Research Brief: ${brief.topic}**

**Confidence**: ${brief.confidence}

**Key Findings**:
${findings}

**Implications**: ${brief.implications}

**Recommended Action**: ${brief.recommendedAction}`;
  }

  private static async logRouting(request: OrchestratorRequest, agent: AgentName): Promise<void> {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      const date = new Date().toISOString().split("T")[0];
      const logFile = path.join(LOG_DIR, `routing-${date}.log`);
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: request.userId,
        agent,
        messageLength: request.message.length,
        conversationId: request.conversationId,
      }) + "\n";
      await fs.appendFile(logFile, entry);
    } catch {}
  }
}
