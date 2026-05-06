/**
 * VoiceMatchedDraftingEngine
 *
 * Drafts replies and follow-ups in the user's tone. It NEVER sends.
 * Sending always goes through DigitalExecutionService after explicit
 * approval.
 *
 * The drafting algorithm is deliberately simple and deterministic so it
 * can run without an LLM call when one is unavailable. Callers may pass
 * tone samples; the engine extracts a few stylistic markers (greeting,
 * sign-off, sentence length, formality) and applies them to the draft.
 */

export interface VoiceSample {
  text: string;
}

export interface DraftInput {
  user_id: string;
  thread_summary: string;
  desired_intent: string;
  voice_samples?: VoiceSample[];
  context?: Record<string, unknown>;
}

export interface DraftResult {
  draft: string;
  confidence: number; // 0..1
  reason: string;
  voice_markers: VoiceMarkers;
}

export interface VoiceMarkers {
  greeting: string;
  sign_off: string;
  formality: "casual" | "neutral" | "formal";
  avg_sentence_length: number;
}

const DEFAULT_GREETING = "Hi";
const DEFAULT_SIGN_OFF = "Thanks";

export class VoiceMatchedDraftingEngine {
  static draft(input: DraftInput): DraftResult {
    const markers = this.extractMarkers(input.voice_samples || []);

    const intro = this.buildIntro(input.thread_summary, markers);
    const body = this.buildBody(input.desired_intent, markers);
    const closing = this.buildClosing(markers);

    const draft = [intro, body, closing].filter(Boolean).join("\n\n");
    const confidence = this.estimateConfidence(input.voice_samples || []);

    return {
      draft,
      confidence,
      reason:
        "Draft prepared from intent and tone signals. Send is disabled until explicit approval.",
      voice_markers: markers,
    };
  }

  private static extractMarkers(samples: VoiceSample[]): VoiceMarkers {
    if (!samples.length) {
      return {
        greeting: DEFAULT_GREETING,
        sign_off: DEFAULT_SIGN_OFF,
        formality: "neutral",
        avg_sentence_length: 14,
      };
    }
    const corpus = samples.map((s) => s.text).join("\n");
    const greeting = this.firstMatch(corpus, [
      /^hey\b/i,
      /^hi\b/i,
      /^hello\b/i,
      /^dear\b/i,
      /^good (morning|afternoon|evening)\b/i,
    ]) || DEFAULT_GREETING;
    const sign_off = this.firstMatch(corpus, [
      /\b(thanks|thank you|cheers|best|regards|sincerely|talk soon)\b/i,
    ]) || DEFAULT_SIGN_OFF;
    const sentences = corpus.split(/[.!?]\s+/).filter(Boolean);
    const wordCount = corpus.split(/\s+/).filter(Boolean).length;
    const avg = sentences.length > 0 ? Math.round(wordCount / sentences.length) : 14;
    const lower = corpus.toLowerCase();
    const formality: VoiceMarkers["formality"] = lower.includes("hey")
      ? "casual"
      : lower.includes("dear ")
        ? "formal"
        : "neutral";
    return { greeting, sign_off, formality, avg_sentence_length: avg };
  }

  private static firstMatch(text: string, regexes: RegExp[]): string | null {
    for (const r of regexes) {
      const m = text.match(r);
      if (m) return m[0];
    }
    return null;
  }

  private static buildIntro(threadSummary: string, markers: VoiceMarkers): string {
    const greeting = this.titleCase(markers.greeting);
    if (markers.formality === "formal") {
      return `${greeting},\n\nThank you for your note regarding ${threadSummary}.`;
    }
    if (markers.formality === "casual") {
      return `${greeting} —\n\nQuick reply on ${threadSummary}:`;
    }
    return `${greeting},\n\nFollowing up on ${threadSummary}.`;
  }

  private static buildBody(desiredIntent: string, markers: VoiceMarkers): string {
    const intent = desiredIntent.trim();
    if (markers.formality === "formal") {
      return `${intent}. Please let me know if any additional information would be useful from my side.`;
    }
    if (markers.formality === "casual") {
      return `${intent}. Lmk if anything else would help.`;
    }
    return `${intent}. Happy to share more detail if useful.`;
  }

  private static buildClosing(markers: VoiceMarkers): string {
    return `${this.titleCase(markers.sign_off)},`;
  }

  private static estimateConfidence(samples: VoiceSample[]): number {
    if (samples.length === 0) return 0.4;
    if (samples.length === 1) return 0.6;
    if (samples.length < 4) return 0.75;
    return 0.85;
  }

  private static titleCase(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

export default VoiceMatchedDraftingEngine;
