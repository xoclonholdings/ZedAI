/**
 * BusinessSubagent: Business Operations and Management
 * Inherits BusinessManagerAgent rules and autonomously activates on business requests.
 */

import { SubagentBase } from "../SubagentBase";
import type {
  SubagentContext,
  SubagentLaneDecision,
  SubagentResult,
  CapabilityLevel,
} from "../SubagentTypes";

const BUSINESS_KEYWORDS = [
  "payroll", "gusto", "contractor", "employee", "onboarding", "benefits", "reimbursement",
  "w-2", "1099", "business manager", "dropshipping", "ecommerce", "business credit",
  "property", "real estate", "acquisition", "deal flow", "underwriting",
];

export class BusinessSubagent extends SubagentBase {
  constructor() {
    super("BusinessSubagent", ["business"], "business");
  }

  protected async decideLane(context: SubagentContext): Promise<SubagentLaneDecision> {
    // Explicit targeting
    if (context.explicitLane === "business") {
      return {
        laneName: "business",
        activated: true,
        confidence: 1.0,
        detectionMethod: "explicit_target",
        reason: "Explicitly targeted to Business lane",
      };
    }

    // Keyword detection
    const lowerMessage = context.message.toLowerCase();
    const hasBusinessKeyword = BUSINESS_KEYWORDS.some((kw) => lowerMessage.includes(kw));

    if (hasBusinessKeyword) {
      return {
        laneName: "business",
        activated: true,
        confidence: 0.85,
        detectionMethod: "keyword",
        reason: "Business-related keywords detected",
      };
    }

    return {
      laneName: "business",
      activated: false,
      confidence: 0,
      detectionMethod: "fallback",
      reason: "No business keywords detected",
    };
  }

  protected async determineCapabilities(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision
  ): Promise<CapabilityLevel[]> {
    const capabilities: CapabilityLevel[] = ["analysis"];

    const lower = context.message.toLowerCase();
    if (lower.includes("payroll") || lower.includes("contractor") || lower.includes("employee")) {
      capabilities.push("action", "approval");
    }

    if (lower.includes("research") || lower.includes("analysis")) {
      capabilities.push("retrieval", "synthesis");
    }

    if (lower.includes("acquisition") || lower.includes("deal")) {
      capabilities.push("reasoning");
    }

    return capabilities;
  }

  protected async executeLane(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision,
    capabilities: CapabilityLevel[]
  ): Promise<SubagentResult> {
    const responseText = `Business Operations:\n- Business intelligence active\n- Operations analysis enabled\n- Deal flow and acquisition research available\n\nCapabilities: ${capabilities.join(", ")}`;

    const lower = context.message.toLowerCase();
    const actionItems = [];

    if (lower.includes("payroll")) {
      actionItems.push({
        type: "payroll_management",
        description: "Manage payroll via Gusto integration",
        requiresApproval: true,
      });
    }

    if (lower.includes("contractor")) {
      actionItems.push({
        type: "contractor_management",
        description: "Manage contractor records and payments",
        requiresApproval: true,
      });
    }

    if (lower.includes("acquisition") || lower.includes("deal")) {
      actionItems.push({
        type: "deal_analysis",
        description: "Analyze acquisition opportunity",
        requiresApproval: false,
      });
    }

    return {
      subagentName: this.name,
      laneName: "business",
      activated: true,
      responseText,
      reasoning: "BusinessSubagent identified business operations or deal analysis request.",
      actionItems,
      metadata: {
        confidence: laneDecision.confidence,
        priority: 2,
      },
      trace: {
        subagentName: this.name,
        laneName: "business",
        activated: true,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        laneDecision,
        capabilities,
        actionsRequested: actionItems.map((a) => ({
          type: a.type,
          approvalRequired: a.requiresApproval,
        })),
        servicesInvoked: ["BusinessManagerAgent"],
        toolsInvoked: [],
        status: "success",
      },
    };
  }
}
