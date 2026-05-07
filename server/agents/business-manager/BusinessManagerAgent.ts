import fs from "fs/promises";
import path from "path";
import { generateChatFromOllama } from "../../services/Ollama/OllamaService";
import { loadAdminSettings } from "../../services/AdminSettingsStore";
import { AgentApprovalAdapter } from "../../services/approval/AgentApprovalAdapter";
import { HUB_LOG_DIR, HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";

export interface BusinessManagerRequest {
  userId: string;
  task: string;
  conversationId?: string;
  memoryContext?: string;
}

export interface BusinessManagerResponse {
  agent: "BusinessManagerAgent";
  message: string;
  planned: boolean;
  capabilities: string[];
  requiresApproval?: boolean;
}

const BUSINESS_LOG_DIR = path.resolve(HUB_LOG_DIR, "business-manager");
const BUSINESS_MEMORY_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "working/current-tasks.md");

function detectCapabilities(task: string) {
  const lower = task.toLowerCase();
  const capabilities = new Set<string>();

  if (/(shop|store|sku|supplier|dropship|fulfillment|ecommerce|product listing|conversion)/.test(lower)) {
    capabilities.add("ecommerce");
    capabilities.add("dropshipping");
  }
  if (/(real estate|property|multifamily|cap rate|rent roll|underwriting|acquisition|deal)/.test(lower)) {
    capabilities.add("realEstate");
    capabilities.add("acquisitions");
  }
  if (/(credit|fundability|tradeline|nav|duns|d&b|business loan|business card)/.test(lower)) {
    capabilities.add("businessCredit");
  }
  if (/(research|trend|opportunity|suggestion|adjacent market|what should|next move)/.test(lower)) {
    capabilities.add("rdSuggestions");
  }
  if (/(payroll|contractor|employee|onboarding|benefits|gusto|reimbursement)/.test(lower)) {
    capabilities.add("gusto");
  }

  return [...capabilities];
}

function needsApproval(task: string) {
  return /(buy|purchase|acquire|sign|commit|submit|apply|send|contact broker|wire|execute)/i.test(task);
}

function capabilityLabel(capability: string) {
  switch (capability) {
    case "ecommerce":
      return "e-commerce";
    case "dropshipping":
      return "dropshipping";
    case "realEstate":
      return "real estate";
    case "acquisitions":
      return "acquisitions";
    case "businessCredit":
      return "business credit";
    case "rdSuggestions":
      return "R&D-driven suggestions";
    case "gusto":
      return "payroll and contractor ops";
    default:
      return capability;
  }
}

export class BusinessManagerAgent {
  static async isActive() {
    const settings = await loadAdminSettings();
    return settings.integrations.businessOperations.enabled;
  }

  static async process(request: BusinessManagerRequest): Promise<BusinessManagerResponse> {
    const settings = await loadAdminSettings();
    const businessOps = settings.integrations.businessOperations;
    const gusto = settings.integrations.gusto;
    const detected = detectCapabilities(request.task);
    const enabledCapabilities = [
      businessOps.ecommerce && "ecommerce",
      businessOps.dropshipping && "dropshipping",
      businessOps.realEstate && "realEstate",
      businessOps.acquisitions && "acquisitions",
      businessOps.businessCredit && "businessCredit",
      businessOps.rdSuggestions && "rdSuggestions",
      gusto.enabled && "gusto",
    ].filter(Boolean) as string[];

    if (!(await this.isActive())) {
      return {
        agent: "BusinessManagerAgent",
        planned: true,
        capabilities: enabledCapabilities.map(capabilityLabel),
        message:
          "The Business Manager lane is not enabled yet. Turn on Business Operations in Admin > Integrations to use planning support for e-commerce, acquisitions, real estate, business credit, and R&D-informed recommendations.",
      };
    }

    const matched = detected.filter((capability) => enabledCapabilities.includes(capability));
    const scope = matched.length > 0 ? matched : enabledCapabilities;
    const approval = needsApproval(request.task);
    const systemPrompt = `You are ZED's Business Manager Agent.

You help with:
- e-commerce and dropshipping operations
- real estate and property acquisition analysis
- business credit and fundability strategy
- acquisition planning and due diligence
- payroll/contractor operations when Gusto is configured
- surfacing suggestions informed by research and market intelligence

Current enabled capabilities: ${scope.map(capabilityLabel).join(", ")}.
If a request would require a real-world commitment, acquisition, send action, or payment, do not pretend it was executed. Instead produce an actionable operating brief with next steps, risks, and an approval recommendation.

${request.memoryContext ? `\nShared knowledge context:\n${request.memoryContext}` : ""}`.trim();

    const reply = await generateChatFromOllama([{ role: "user", content: request.task }], systemPrompt, {
      lane: "business",
    });
    await this.writeToMemory(request, reply, scope, approval);
    await this.log(request, reply, scope, approval);

    let approvalSuffix = "";
    if (approval) {
      try {
        const registered = await AgentApprovalAdapter.register({
          user_id: request.userId,
          conversation_id: request.conversationId || null,
          message: request.task,
          draft: reply,
          agent: "BusinessManagerAgent",
          capabilities: scope.map(capabilityLabel),
        });
        approvalSuffix = `\n\nLogged as task ${registered.task_id} (${registered.approval_status}). Admin will review before any real-world commitment.`;
      } catch (err) {
        console.warn("[BusinessManagerAgent] Approval registration failed:", err);
        approvalSuffix = "\n\nAdmin approval is recommended before any real-world commitment or outbound action.";
      }
    }

    return {
      agent: "BusinessManagerAgent",
      planned: false,
      capabilities: scope.map(capabilityLabel),
      requiresApproval: approval,
      message: approval ? `${reply}${approvalSuffix}` : reply,
    };
  }

  private static async writeToMemory(
    request: BusinessManagerRequest,
    reply: string,
    capabilities: string[],
    requiresApproval: boolean,
  ) {
    try {
      const entry = `\n## [${new Date().toISOString()}] Business Manager\n**User**: ${request.userId}\n**Capabilities**: ${capabilities.map(capabilityLabel).join(", ")}\n**Approval**: ${requiresApproval ? "recommended" : "not required"}\n**Request**: ${request.task}\n**Response**: ${reply.slice(0, 300)}...\n`;
      await fs.appendFile(BUSINESS_MEMORY_PATH, entry);
    } catch {}
  }

  private static async log(
    request: BusinessManagerRequest,
    reply: string,
    capabilities: string[],
    requiresApproval: boolean,
  ) {
    try {
      await fs.mkdir(BUSINESS_LOG_DIR, { recursive: true });
      const logPath = path.join(BUSINESS_LOG_DIR, `${new Date().toISOString().split("T")[0]}.log`);
      const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: request.userId,
        conversationId: request.conversationId,
        task: request.task,
        replyLength: reply.length,
        capabilities,
        requiresApproval,
      }) + "\n";
      await fs.appendFile(logPath, line);
    } catch {}
  }
}
