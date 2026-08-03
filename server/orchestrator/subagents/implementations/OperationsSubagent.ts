/**
 * OperationsSubagent: Calendar, Email, Tasks, and Personal Assistant
 * Inherits OperationsAgent rules and autonomously activates on task/calendar requests.
 */

import { SubagentBase } from "../SubagentBase";
import type {
  SubagentContext,
  SubagentLaneDecision,
  SubagentResult,
  CapabilityLevel,
} from "../SubagentTypes";

const OPERATIONS_KEYWORDS = [
  "calendar", "schedule", "reschedule", "meeting", "appointment", "email", "send email", "draft email", "reply to",
  "task", "todo", "to-do", "to do", "remind me", "post to", "post on", "publish", "tweet", "draft post",
  "send invoice", "invoice", "cancel", "book ", "call", "voicemail", "phone",
];

export class OperationsSubagent extends SubagentBase {
  constructor() {
    super("OperationsSubagent", ["operations"], "operations");
  }

  protected async decideLane(context: SubagentContext): Promise<SubagentLaneDecision> {
    // Explicit targeting
    if (context.explicitLane === "operations") {
      return {
        laneName: "operations",
        activated: true,
        confidence: 1.0,
        detectionMethod: "explicit_target",
        reason: "Explicitly targeted to Operations lane",
      };
    }

    // Keyword detection
    const lowerMessage = context.message.toLowerCase();
    const hasOperationsKeyword = OPERATIONS_KEYWORDS.some((kw) => lowerMessage.includes(kw));

    if (hasOperationsKeyword) {
      return {
        laneName: "operations",
        activated: true,
        confidence: 0.9,
        detectionMethod: "keyword",
        reason: "Operations-related keywords detected",
      };
    }

    return {
      laneName: "operations",
      activated: false,
      confidence: 0,
      detectionMethod: "fallback",
      reason: "No operations/tasks keywords detected",
    };
  }

  protected async determineCapabilities(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision
  ): Promise<CapabilityLevel[]> {
    const capabilities: CapabilityLevel[] = ["action"];

    const lower = context.message.toLowerCase();
    if (lower.includes("send") || lower.includes("schedule") || lower.includes("create")) {
      capabilities.push("approval");
    }

    capabilities.push("analysis");

    return capabilities;
  }

  protected async executeLane(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision,
    capabilities: CapabilityLevel[]
  ): Promise<SubagentResult> {
    const responseText = `Operations Processing:\n- Calendar integration ready\n- Email drafting enabled\n- Task creation active\n- Approval policy: respecting user settings\n\nActions: ${capabilities.join(", ")}`;

    const lower = context.message.toLowerCase();
    const actionItems = [];

    if (lower.includes("send email") || lower.includes("draft email")) {
      actionItems.push({
        type: "draft_email",
        description: "Draft email for user review",
        requiresApproval: true,
      });
    }

    if (lower.includes("schedule") || lower.includes("calendar")) {
      actionItems.push({
        type: "schedule_event",
        description: "Schedule calendar event",
        requiresApproval: context.approvalPolicy?.operations === "ask" || context.approvalPolicy?.operations === "Ask me",
      });
    }

    if (lower.includes("task") || lower.includes("todo")) {
      actionItems.push({
        type: "create_task",
        description: "Create task or reminder",
        requiresApproval: false,
      });
    }

    return {
      subagentName: this.name,
      laneName: "operations",
      activated: true,
      responseText,
      reasoning: "OperationsSubagent evaluated request for calendar, email, and task operations.",
      actionItems,
      metadata: {
        confidence: laneDecision.confidence,
        priority: 2,
      },
      trace: {
        subagentName: this.name,
        laneName: "operations",
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
        servicesInvoked: ["OperationsAgent", "CalendarService", "EmailService", "TaskService"],
        toolsInvoked: [],
        status: "success",
      },
    };
  }
}
