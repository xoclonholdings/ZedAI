/**
 * Capability 5 — Self-Orchestrating Intelligence.
 *
 * The operational brain. Before ZED answers, this engine decides what
 * actually needs to happen: which internal capabilities to engage rather
 * than making the user invoke agents by hand. It maps the message onto
 * ZED's real subsystems — memory, knowledge graph, uploaded documents,
 * research, specialist agents, scheduling, approvals, reports,
 * calculation, workflows, project-state updates, notifications — and
 * emits a capability activation plan.
 *
 * The plan does two things:
 *   1. It is recorded on the execution trace so the plan is observable.
 *   2. It is injected as a directive so the model proactively uses the
 *      capabilities it has instead of stalling or asking the user to
 *      "run the research agent".
 *
 * It respects existing guardrails: anything that touches the outside
 * world (approvals, notifications, scheduling, state changes) is flagged
 * non-autonomous so the existing approval policy and routing still own
 * the actual side effect. This engine decides *intent*, not side effects.
 */

import { detectTaskType } from "./analysis";
import type {
  Capability,
  CapabilityDecision,
  SelfOrchestrationResult,
} from "./types";

export interface SelfOrchestrationInput {
  message: string;
  /** Conversation has uploaded, processed files available. */
  hasFiles?: boolean;
  /** Object/document knowledge graph has content relevant to retrieve. */
  hasGraphContext?: boolean;
  /** Persisted memory context is available for this user. */
  hasMemory?: boolean;
}

interface Rule {
  capability: Capability;
  pattern: RegExp;
  reason: string;
  autonomous: boolean;
  confidence: number;
}

const RULES: Rule[] = [
  {
    capability: "launch_research",
    pattern: /\b(research|latest|current|news|market|look up|search the web|find out|what'?s happening|trend|price of|stock|crypto|competitor)\b/i,
    reason: "Request needs fresh external information, not just stored context.",
    autonomous: true,
    confidence: 0.8,
  },
  {
    capability: "perform_calculation",
    pattern: /\b(calculate|compute|how much|how many|total|sum|average|percentage|ratio|convert|roi|margin|projection)\b/i,
    reason: "Request contains a quantitative computation.",
    autonomous: true,
    confidence: 0.75,
  },
  {
    capability: "generate_report",
    pattern: /\b(report|write[- ]?up|brief|memo|summary document|full analysis|deliverable|deck)\b/i,
    reason: "Request asks for a structured deliverable.",
    autonomous: true,
    confidence: 0.7,
  },
  {
    capability: "schedule_work",
    pattern: /\b(schedule|remind me|later|tomorrow|next week|recurring|every (?:day|week|month)|set up a (?:reminder|job)|cron)\b/i,
    reason: "Request implies future or recurring work.",
    autonomous: false,
    confidence: 0.7,
  },
  {
    capability: "request_approval",
    pattern: /\b(send|email|publish|post|pay|invoice|deploy|delete|cancel|transfer|purchase|sign)\b/i,
    reason: "Request may trigger an outward action that requires approval.",
    autonomous: false,
    confidence: 0.65,
  },
  {
    capability: "notify_user",
    pattern: /\b(notify|alert|let me know|ping me|tell me when|flag me)\b/i,
    reason: "Request asks to be informed of an event.",
    autonomous: false,
    confidence: 0.6,
  },
  {
    capability: "run_workflow",
    pattern: /\b(workflow|flow|pipeline|automate|orchestrate|run the|kick off|end to end)\b/i,
    reason: "Request maps onto a multi-step workflow.",
    autonomous: true,
    confidence: 0.65,
  },
  {
    capability: "update_project_state",
    pattern: /\b(update (?:the )?(?:project|status|state)|mark (?:as )?done|complete(?:d)? the task|log this|record (?:this|that)|save (?:this|that) (?:to|as))\b/i,
    reason: "Request implies a change to tracked project state.",
    autonomous: false,
    confidence: 0.6,
  },
];

const LANE_RULES: Array<[SelfOrchestrationResult["suggestedLane"], RegExp]> = [
  ["finance", /\b(trade|trading|invest|portfolio|forex|crypto|stock|market|wealth|capital|position|hedge)\b/i],
  ["business", /\b(business|revenue|customer|marketing|sales|operations|pricing|partnership|payroll|invoice)\b/i],
  ["research", /\b(research|analy[sz]e|investigate|compare|study|sources|deep dive|predict)\b/i],
  ["operations", /\b(email|calendar|task|schedule|file|remind|send|draft|organize)\b/i],
];

export class SelfOrchestrationEngine {
  static plan(input: SelfOrchestrationInput): SelfOrchestrationResult {
    const message = String(input.message || "");
    const decisions: CapabilityDecision[] = [];

    // Always-available retrieval capabilities, gated on real availability.
    if (input.hasMemory !== false) {
      decisions.push({
        capability: "search_memory",
        reason: "Recall prior conversations, decisions, and preferences before answering.",
        confidence: 0.9,
        autonomous: true,
      });
    }
    if (input.hasGraphContext) {
      decisions.push({
        capability: "search_knowledge_graph",
        reason: "Relevant structured knowledge exists in the graph for this query.",
        confidence: 0.85,
        autonomous: true,
      });
    }
    if (input.hasFiles) {
      decisions.push({
        capability: "search_documents",
        reason: "Uploaded documents in this conversation may answer the request.",
        confidence: 0.85,
        autonomous: true,
      });
    } else if (/\b(document|file|upload|pdf|attachment|the doc|this file)\b/i.test(message)) {
      decisions.push({
        capability: "search_documents",
        reason: "User references a document; check uploaded and ingested sources.",
        confidence: 0.6,
        autonomous: true,
      });
    }

    for (const rule of RULES) {
      if (rule.pattern.test(message)) {
        decisions.push({
          capability: rule.capability,
          reason: rule.reason,
          confidence: rule.confidence,
          autonomous: rule.autonomous,
        });
      }
    }

    // A specialist task that isn't plain conversation implies an agent lane.
    const taskType = detectTaskType(message);
    let suggestedLane: SelfOrchestrationResult["suggestedLane"] = null;
    for (const [lane, pattern] of LANE_RULES) {
      if (pattern.test(message)) {
        suggestedLane = lane;
        break;
      }
    }
    if (suggestedLane && taskType !== "conversation") {
      decisions.push({
        capability: "call_agent",
        reason: `Request fits the ${suggestedLane} specialist lane.`,
        confidence: 0.7,
        autonomous: true,
      });
    }

    // De-duplicate, keeping the highest-confidence decision per capability.
    const byCapability = new Map<Capability, CapabilityDecision>();
    for (const d of decisions) {
      const existing = byCapability.get(d.capability);
      if (!existing || d.confidence > existing.confidence) byCapability.set(d.capability, d);
    }
    const finalDecisions = [...byCapability.values()].sort((a, b) => b.confidence - a.confidence);

    const engaged = finalDecisions.length > 0;
    const autonomousList = finalDecisions.filter((d) => d.autonomous);
    const approvalList = finalDecisions.filter((d) => !d.autonomous);

    const prompt = engaged
      ? [
          "## Self-Orchestration Plan (operational brain)",
          "You decide what needs to happen next — do not make the user invoke tools or agents by hand. For this turn:",
          ...autonomousList.map((d) => `- USE ${d.capability.replace(/_/g, " ")}: ${d.reason}`),
          ...approvalList.map(
            (d) =>
              `- PROPOSE ${d.capability.replace(/_/g, " ")} (${d.reason}) — do not perform the outward action yourself; state clearly that it needs confirmation and let the approval flow handle it.`,
          ),
          "Engage the autonomous capabilities silently as part of answering. Only surface the ones that need confirmation.",
        ].join("\n")
      : "";

    return { engaged, decisions: finalDecisions, suggestedLane, prompt };
  }
}

export default SelfOrchestrationEngine;
