/**
 * SchedulingAssistant
 *
 * Prepares scheduling responses. It can read user availability when a
 * calendar provider is wired in (currently optional), suggest windows,
 * draft a reply, and prepare a calendar invite payload — but it never
 * books or sends anything until explicit approval.
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
    if (availability && availability.length > 0) {
      return availability.slice(0, 4);
    }
    return this.suggestDefaultWindows(duration);
  }

  private static suggestDefaultWindows(duration: number): Availability[] {
    const now = new Date();
    const windows: Availability[] = [];
    for (let day = 1; day <= 4; day++) {
      const start = new Date(now);
      start.setDate(start.getDate() + day);
      start.setHours(10, 0, 0, 0);
      const end = new Date(start.getTime() + duration * 60_000);
      windows.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: `${start.toDateString()} 10:00–${end.getHours()}:${String(end.getMinutes()).padStart(2, "0")}`,
      });
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
