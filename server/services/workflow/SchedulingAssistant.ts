/**
 * SchedulingAssistant
 *
 * Prepares scheduling responses from authorized availability supplied by a
 * governed calendar adapter or the authenticated user. It never invents
 * availability and never books or sends anything until explicit approval.
 */

export interface Availability {
  /** ISO timestamp window start. */
  start: string;
  /** ISO timestamp window end. */
  end: string;
  label?: string;
}

export interface SchedulingRequest {
  user_id: string;
  preferred_duration_minutes: number;
  message_excerpt: string;
  /** Caller-supplied availability when a calendar integration is present. */
  availability?: Availability[];
  timezone?: string;
}

export interface SchedulingDraft {
  suggested_windows: Availability[];
  reply_draft: string;
  calendar_invite_payload: CalendarInvitePayload;
  awaiting_approval: true;
}

export interface CalendarInvitePayload {
  title: string;
  duration_minutes: number;
  proposed_windows: Availability[];
  organizer_user_id: string;
  notes: string;
}

export class SchedulingAssistant {
  static prepare(req: SchedulingRequest): SchedulingDraft {
    const windows = this.pickWindows(req.availability, req.preferred_duration_minutes);
    const tz = req.timezone || "UTC";

    const replyLines: string[] = [
      `Thanks for reaching out — happy to find a time.`,
      ``,
      `A few options that work on my end (${tz}):`,
      ...windows.map((w, i) => `  ${i + 1}. ${w.label || `${w.start} – ${w.end}`}`),
      ``,
      `Let me know which works best and I'll send a calendar invite.`,
    ];

    const calendar_invite_payload: CalendarInvitePayload = {
      title: this.deriveTitle(req.message_excerpt),
      duration_minutes: req.preferred_duration_minutes,
      proposed_windows: windows,
      organizer_user_id: req.user_id,
      notes: `Drafted by SchedulingAssistant. Awaiting user approval before send.`,
    };

    return {
      suggested_windows: windows,
      reply_draft: replyLines.join("\n"),
      calendar_invite_payload,
      awaiting_approval: true,
    };
  }

  private static pickWindows(
    availability: Availability[] | undefined,
    duration: number,
  ): Availability[] {
    if (!availability?.length) {
      throw new Error(
        "Verified calendar availability is required. Connect Calendar in Settings -> Integrations or provide authorized availability windows.",
      );
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("preferred_duration_minutes must be greater than zero.");
    }
    const windows = availability.slice(0, 4);
    for (const window of windows) {
      const start = new Date(window.start).getTime();
      const end = new Date(window.end).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        throw new Error("Each availability window needs a valid start and end time.");
      }
      if (end - start < duration * 60_000) {
        throw new Error(
          "Each availability window must be at least as long as the requested meeting duration.",
        );
      }
    }
    return windows;
  }

  private static deriveTitle(excerpt: string): string {
    const trimmed = (excerpt || "").trim();
    if (!trimmed) return "Meeting";
    const firstSentence = trimmed.split(/[.!?\n]/)[0] || trimmed;
    return firstSentence.slice(0, 80);
  }
}

export default SchedulingAssistant;
