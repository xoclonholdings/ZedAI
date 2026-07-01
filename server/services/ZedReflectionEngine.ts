import { MemoryService } from "./memoryService";

export interface ZedReflectionInput {
  userId: string;
  conversationId?: string;
  userMessage: string;
  assistantReply: string;
  route: "chat" | "orchestrate" | "legacy-chat";
  strategic?: boolean;
  contextInquiry?: boolean;
  requiresApproval?: boolean;
  tags?: string[];
}

export interface ZedReflectionResult {
  stored: boolean;
  reason: string;
  summary?: string;
}

const INTERNAL_TERMS = /\b(chain[- ]of[- ]thought|hidden prompt|system prompt|developer message|tool call|provider|source trail|workflow name|route name|graph id|embedding|retrieval chunk|confidence math|internal score)\b/gi;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function excerpt(value: string, max = 420): string {
  const cleaned = compactWhitespace(value).replace(INTERNAL_TERMS, "internal detail");
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trim()}...` : cleaned;
}

function shouldStoreReflection(input: ZedReflectionInput): { store: boolean; reason: string } {
  const text = `${input.userMessage}\n${input.assistantReply}`;
  if (input.contextInquiry) return { store: false, reason: "context inquiry question only" };
  if (input.requiresApproval) return { store: true, reason: "approval-relevant reply" };
  if (input.strategic) return { store: true, reason: "strategic reasoning reply" };
  if (/\b(decision|decided|remember|correction|stop saying|do not say|next step|blocker|risk|approval|plan|roadmap|architecture|strategy|launch|trade|finance|zwap|zcos|zed)\b/i.test(text)) {
    return { store: true, reason: "operationally relevant reply" };
  }
  if (input.assistantReply.length > 1200) return { store: true, reason: "substantial reply" };
  return { store: false, reason: "low-value transient exchange" };
}

function buildSummary(input: ZedReflectionInput, reason: string): string {
  const lines = [
    `Route: ${input.route}`,
    `Reason: ${reason}`,
    input.strategic ? "Strategic: yes" : "Strategic: no",
    input.requiresApproval ? "Approval relevant: yes" : "Approval relevant: no",
    `User asked: ${excerpt(input.userMessage, 360)}`,
    `ZED answered: ${excerpt(input.assistantReply, 520)}`,
  ];

  return lines.join("\n");
}

export class ZedReflectionEngine {
  static async reflectAfterReply(input: ZedReflectionInput): Promise<ZedReflectionResult> {
    const decision = shouldStoreReflection(input);
    if (!decision.store) {
      return { stored: false, reason: decision.reason };
    }

    const summary = buildSummary(input, decision.reason);
    await MemoryService.createProjectMemory({
      userId: input.userId,
      name: `ZED reflection - ${new Date().toISOString()}`,
      description: "Safe post-response reflection summary. No raw chain-of-thought or hidden prompt content.",
      content: summary,
      type: "reflection",
      isActive: true,
    });

    return { stored: true, reason: decision.reason, summary };
  }
}
