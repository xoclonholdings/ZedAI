import fs from "fs/promises";
import path from "path";
import { generateChatFromOllama } from "../../services/Ollama/OllamaService";
import { logSecurityEvent } from "../../services/SecurityAudit";
import { loadAdminSettings } from "../../services/AdminSettingsStore";
import { HUB_LOG_DIR, HUB_SHARED_MEMORY_DIR, REPO_ROOT } from "../../utils/repoPaths";

const SKILL_PATH = path.resolve(REPO_ROOT, "server/agents/operations/SKILL.md");
const WORKING_MEMORY = path.resolve(HUB_SHARED_MEMORY_DIR, "working/current-tasks.md");
const EPISODIC_MEMORY = path.resolve(HUB_SHARED_MEMORY_DIR, "episodic/email-decisions.json");
const APPROVAL_QUEUE = path.resolve(HUB_SHARED_MEMORY_DIR, "episodic/approval-queue.json");
const GUIDELINES = path.resolve(HUB_SHARED_MEMORY_DIR, "consensus/posting-guidelines.md");
const LOG_DIR = path.resolve(HUB_LOG_DIR, "operations");

export interface AgentRequest {
  userId: string;
  message: string;
  conversationId?: string;
  context?: Record<string, any>;
  memoryContext?: string;
}

export interface AgentResponse {
  reply: string;
  agent: "OperationsAgent";
  actions?: AgentAction[];
  requiresApproval?: boolean;
  pendingApproval?: string;
}

export interface AgentAction {
  type: "task_created" | "draft_created" | "memory_written" | "approval_required";
  description: string;
  data?: any;
}

export class OperationsAgent {
  private static skill: string | null = null;
  private static guidelines: string | null = null;

  static async loadSkill(): Promise<string> {
    if (this.skill) return this.skill;
    try {
      this.skill = await fs.readFile(SKILL_PATH, "utf-8");
    } catch {
      this.skill = "Operations Agent: Handle executive, communication, and scheduling tasks. Be direct, actionable, and brand-aligned.";
    }
    return this.skill;
  }

  static async loadGuidelines(): Promise<string> {
    if (this.guidelines) return this.guidelines;
    try {
      this.guidelines = await fs.readFile(GUIDELINES, "utf-8");
    } catch {
      this.guidelines = "Be professional, direct, and brand-aligned.";
    }
    return this.guidelines;
  }

  static async process(request: AgentRequest): Promise<AgentResponse> {
    const [skill, guidelines, settings] = await Promise.all([
      this.loadSkill(),
      this.loadGuidelines(),
      loadAdminSettings(),
    ]);

    const actions: AgentAction[] = [];
    const email = settings.integrations.email;
    const telephony = settings.integrations.telephony;
    const knowledgeBlock = request.memoryContext ? `\n\n${request.memoryContext}` : "";

    const capabilityBlock = `## Executive Capability Surface
- Email lane: ${email.enabled ? `${email.status} via ${email.provider}` : "not configured"}
- Email sender: ${email.fromAddress || "not set"}
- Telephony lane: ${telephony.enabled ? `${telephony.status} via ${telephony.provider}` : "not configured"}
- Managed phone number: ${telephony.phoneNumber || "not set"}
- Voicemail routing email: ${telephony.voicemailEmail || "not set"}

If the user asks to send an email, place a call, return a missed call, or handle voicemail, produce an execution-ready draft or operating plan and clearly say whether provider-backed execution is currently possible. Never claim a real outbound email or call happened unless a live provider is configured and the action was explicitly approved.`;

    const systemPrompt = `${skill}

## Brand Voice Guidelines
${guidelines}

${capabilityBlock}${knowledgeBlock}

## Session Context
User: ${request.userId}
ConversationID: ${request.conversationId || "none"}`.trim();

    const reply = await generateChatFromOllama([{ role: "user", content: request.message }], systemPrompt);
    const requiresApproval = this.checkApprovalRequired(request.message, reply);

    if (requiresApproval) {
      actions.push({
        type: "approval_required",
        description: "This action requires ADMIN approval before execution",
        data: { message: request.message, draft: reply },
      });
      await this.queueForApproval(request, reply);
    }

    await this.writeToMemory(request, reply, actions);
    await this.log(request, reply, requiresApproval);

    return {
      reply,
      agent: "OperationsAgent",
      actions,
      requiresApproval,
    };
  }

  private static checkApprovalRequired(message: string, _reply: string): boolean {
    const approvalTriggers = [
      "send email",
      "reply by email",
      "call",
      "voicemail",
      "post to",
      "publish",
      "deploy",
      "delete",
      "schedule meeting",
      "cancel meeting",
      "send invoice",
    ];
    const lower = message.toLowerCase();
    return approvalTriggers.some((trigger) => lower.includes(trigger));
  }

  private static async queueForApproval(request: AgentRequest, draft: string): Promise<void> {
    try {
      let queue: any = { version: "1.0", entries: [] };
      try {
        const raw = await fs.readFile(APPROVAL_QUEUE, "utf-8");
        queue = JSON.parse(raw);
      } catch {}

      queue.entries.push({
        id: `approval-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: "pending",
        userId: request.userId,
        conversationId: request.conversationId || null,
        message: request.message,
        draft: draft.slice(0, 700),
        agent: "OperationsAgent",
      });

      await fs.writeFile(APPROVAL_QUEUE, JSON.stringify(queue, null, 2));
      await logSecurityEvent({
        type: "approval.queued",
        userId: request.userId,
        detail: `Queued for approval: ${request.message.slice(0, 80)}`,
      });
    } catch (err) {
      console.warn("[OperationsAgent] Approval queue write failed:", err);
    }
  }

  private static async writeToMemory(request: AgentRequest, reply: string, actions: AgentAction[]): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const entry = `\n## [${timestamp}] User: ${request.userId}\n**Request**: ${request.message}\n**Response**: ${reply.slice(0, 200)}...\n`;
      await fs.appendFile(WORKING_MEMORY, entry).catch(() => {});

      if (actions.some((action) => action.type === "approval_required")) {
        let episodic: any = { entries: [] };
        try {
          const raw = await fs.readFile(EPISODIC_MEMORY, "utf-8");
          episodic = JSON.parse(raw);
        } catch {}

        episodic.entries.push({
          timestamp,
          userId: request.userId,
          message: request.message,
          outcome: "pending_approval",
        });
        await fs.writeFile(EPISODIC_MEMORY, JSON.stringify(episodic, null, 2)).catch(() => {});
      }
    } catch (err) {
      console.warn("[OperationsAgent] Memory write failed:", err);
    }
  }

  private static async log(request: AgentRequest, reply: string, requiresApproval: boolean): Promise<void> {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      const date = new Date().toISOString().split("T")[0];
      const logFile = path.join(LOG_DIR, `${date}.log`);
      const entry =
        JSON.stringify({
          timestamp: new Date().toISOString(),
          userId: request.userId,
          message: request.message,
          replyLength: reply.length,
          requiresApproval,
        }) + "\n";
      await fs.appendFile(logFile, entry);
    } catch {}
  }
}
