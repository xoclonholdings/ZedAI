/**
 * MeetingFollowUpGenerator
 *
 * Turns meeting notes / transcripts into:
 *   - a short summary
 *   - action items
 *   - a follow-up reply draft
 *   - structured task records that can be fed to TaskExecutionEngine
 *
 * Pure transformation — no I/O, no provider calls.
 */

export interface MeetingFollowUpInput {
  user_id: string;
  meeting_title: string;
  participants?: string[];
  notes_or_transcript: string;
  occurred_at?: string;
  /** Explicit, already-resolved ownership supplied by the caller. */
  explicit_action_owners?: Array<{
    line_match: string;
    recipient_id: string;
  }>;
}

export interface ActionItem {
  description: string;
  owner: string | null;
  owner_resolution: "verified" | "unresolved";
  due?: string;
  source_excerpt: string;
}

export interface MeetingFollowUpResult {
  summary: string;
  action_items: ActionItem[];
  follow_up_draft: string;
  task_seeds: Array<{
    user_request: string;
    context: { meeting_title: string; participants?: string[]; owner: string };
  }>;
}

const ACTION_VERBS = [
  "send", "draft", "schedule", "book", "follow up", "follow-up", "review",
  "share", "circulate", "update", "confirm", "submit", "investigate",
  "call", "email", "reach out", "ping", "deliver", "ship",
];

export class MeetingFollowUpGenerator {
  static generate(input: MeetingFollowUpInput): MeetingFollowUpResult {
    const lines = (input.notes_or_transcript || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const summary = this.buildSummary(input, lines);
    const action_items = this.extractActionItems(lines, input);
    const follow_up_draft = this.buildFollowUpDraft(input, summary, action_items);
    const task_seeds = action_items
      .filter((item): item is ActionItem & { owner: string } => item.owner !== null)
      .map((item) => ({
        user_request: item.description,
        context: {
          meeting_title: input.meeting_title,
          participants: input.participants,
          owner: item.owner,
        },
      }));

    return { summary, action_items, follow_up_draft, task_seeds };
  }

  private static buildSummary(input: MeetingFollowUpInput, lines: string[]): string {
    const head = lines.slice(0, 6).join(" ");
    const trimmed = head.length > 480 ? `${head.slice(0, 480)}…` : head;
    const who = input.participants?.length
      ? ` Participants: ${input.participants.join(", ")}.`
      : "";
    return `Meeting "${input.meeting_title}".${who} Discussion summary: ${trimmed}`;
  }

  private static extractActionItems(
    lines: string[],
    input: MeetingFollowUpInput,
  ): ActionItem[] {
    const items: ActionItem[] = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      const verbHit = ACTION_VERBS.find((v) => lower.includes(v));
      const explicit = lower.startsWith("action:") ||
        lower.startsWith("ai:") ||
        lower.startsWith("- [ ]") ||
        lower.startsWith("todo:") ||
        lower.startsWith("to-do:");
      if (!verbHit && !explicit) continue;

      const owner = this.resolveExplicitOwner(line, input.explicit_action_owners);
      items.push({
        description: line.replace(/^(action:|ai:|todo:|to-do:|-\s*\[\s*\]\s*)/i, "").trim(),
        owner,
        owner_resolution: owner ? "verified" : "unresolved",
        source_excerpt: line.slice(0, 200),
      });
    }
    return items;
  }

  private static resolveExplicitOwner(
    line: string,
    explicitOwners?: MeetingFollowUpInput["explicit_action_owners"],
  ): string | null {
    const normalized = line.toLowerCase();
    for (const owner of explicitOwners || []) {
      const match = owner.line_match.trim().toLowerCase();
      if (match && normalized.includes(match) && owner.recipient_id.trim()) {
        return owner.recipient_id.trim();
      }
    }
    return null;
  }

  private static buildFollowUpDraft(
    input: MeetingFollowUpInput,
    summary: string,
    actionItems: ActionItem[],
  ): string {
    const bullets = actionItems
      .map((item) =>
        `  • ${item.description} (owner: ${item.owner || "unresolved - verification required"})`,
      )
      .join("\n");
    return [
      `Hi all,`,
      ``,
      `Quick recap from "${input.meeting_title}":`,
      ``,
      summary,
      ``,
      actionItems.length ? `Action items:\n${bullets}` : `No action items captured.`,
      ``,
      `Reply with corrections — otherwise I'll proceed with the items above.`,
      ``,
      `Thanks,`,
    ].join("\n");
  }
}

export default MeetingFollowUpGenerator;
