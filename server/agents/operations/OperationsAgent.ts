import fs from "fs/promises";
import path from "path";
import { generateBufferedStreamFromProvider } from "../../services/ModelProviderService";
import { loadAdminSettings } from "../../services/AdminSettingsStore";
import { AgentApprovalAdapter } from "../../services/approval/AgentApprovalAdapter";
import { decideApprovalPolicy } from "../../services/approvalPolicy";
import { HUB_LOG_DIR, HUB_SHARED_MEMORY_DIR, REPO_ROOT } from "../../utils/repoPaths";

const SKILL_PATH = path.resolve(REPO_ROOT, "server/agents/operations/SKILL.md");
const WORKING_MEMORY = path.resolve(HUB_SHARED_MEMORY_DIR, "working/current-tasks.md");
const EPISODIC_MEMORY = path.resolve(HUB_SHARED_MEMORY_DIR, "episodic/email-decisions.json");
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
  task?: StructuredOperationTask;
}

export interface AgentAction {
  type:
    | "task_created"
    | "draft_created"
    | "memory_written"
    | "approval_required"
    | "policy_refused";
  description: string;
  data?: any;
}

export interface StructuredOperationTask {
  actionType: "send_email" | "draft_email" | "schedule_calendar_item" | "send_message" | "create_task" | "general";
  requiresApproval: boolean;
  dispatchPayload?: Record<string, any>;
  providerStatus?: "enabled" | "disabled" | "draft_only";
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
    const task = this.parseStructuredTask(request.message, email.enabled);

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

    // Consult the user's ApprovalSettings BEFORE the model call so a
    // "never" mode can short-circuit without wasting a generation.
    const policy = await decideApprovalPolicy(request.message);

    if (policy.mode === "never") {
      const refusalReply = policy.refusalReply || "Zed isn't allowed to do that per your Settings.";
      await this.writeToMemory(request, refusalReply, [
        {
          type: "policy_refused",
          description: `Refused: ${policy.category || "unknown"} is set to Never in Settings.`,
          data: { message: request.message, category: policy.category },
        },
      ]);
      await this.log(request, refusalReply, false);
      return {
        reply: refusalReply,
        agent: "OperationsAgent",
        actions: [
          {
            type: "policy_refused",
            description: refusalReply,
            data: { category: policy.category },
          },
        ],
        requiresApproval: false,
        task,
      };
    }

    // Stream-then-buffer per SPEC.md line 111: provider streams to
    // server, server buffers, presentZedResponse (applied upstream)
    // acts on complete text before it reaches the client. Gains
    // provider-timeout resilience without changing user-visible UX.
    const reply = await generateBufferedStreamFromProvider(
      [{ role: "user", content: request.message }],
      systemPrompt,
      { lane: "operations" },
    );
    // policy.mode is "auto" or "ask" here. "auto" means dispatch
    // without gating; "ask" queues for admin approval.
    const requiresApproval = policy.mode === "ask";

    if (requiresApproval) {
      const pending = await this.queueForApproval(request, reply, task);
      actions.push({
        type: "approval_required",
        description: "This action requires ADMIN approval before execution",
        data: {
          message: request.message,
          draft: reply,
          task,
          approvalId: pending,
          category: policy.category,
        },
      });
    }

    await this.writeToMemory(request, reply, actions);
    await this.log(request, reply, requiresApproval);

    return {
      reply,
      agent: "OperationsAgent",
      actions,
      requiresApproval,
      pendingApproval: actions.find((action) => action.type === "approval_required")?.data?.approvalId,
      task,
    };
  }

  private static parseStructuredTask(message: string, emailEnabled: boolean): StructuredOperationTask {
    const lower = message.toLowerCase();
    if (/\bsend an? email\b|\bsend email\b|\breply by email\b/.test(lower)) {
      const to = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
      const saying = message.match(/\bsaying\s+([\s\S]+)$/i)?.[1]?.trim();
      return {
        actionType: "send_email",
        requiresApproval: true,
        providerStatus: emailEnabled ? "enabled" : "disabled",
        dispatchPayload: {
          to,
          subject: "Message from ZED",
          body: saying || message,
        },
      };
    }
    if (/\bdraft an? email\b|\bdraft email\b/.test(lower)) {
      return {
        actionType: "draft_email",
        requiresApproval: false,
        providerStatus: "draft_only",
      };
    }
    if (/\bschedule\b|\bcalendar\b|\bmeeting\b|\bappointment\b/.test(lower)) {
      return {
        actionType: "schedule_calendar_item",
        requiresApproval: true,
        providerStatus: "draft_only",
      };
    }
    if (/\bsend (a )?message\b|\btext\b/.test(lower)) {
      return {
        actionType: "send_message",
        requiresApproval: true,
        providerStatus: "disabled",
      };
    }
    if (/\bcreate (a )?task\b|\btodo\b|\bto-do\b/.test(lower)) {
      return {
        actionType: "create_task",
        requiresApproval: false,
        providerStatus: "enabled",
      };
    }
    return { actionType: "general", requiresApproval: false, providerStatus: "enabled" };
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

  private static async queueForApproval(
    request: AgentRequest,
    draft: string,
    task: StructuredOperationTask,
  ): Promise<string | undefined> {
    try {
      const dispatch =
        task.actionType === "send_email" && task.dispatchPayload
          ? { action_type: "email" as const, payload: task.dispatchPayload }
          : undefined;
      const registered = await AgentApprovalAdapter.register({
        user_id: request.userId,
        conversation_id: request.conversationId || null,
        message: request.message,
        draft: `${draft}\n\nDispatch payload:\n${JSON.stringify(task, null, 2)}`,
        agent: "OperationsAgent",
        dispatch,
      });
      return registered.task_id;
    } catch (err) {
      console.warn("[OperationsAgent] Approval registration failed:", err);
      return undefined;
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
