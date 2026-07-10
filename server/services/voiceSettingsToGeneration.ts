import type { VoiceSettings } from "../../shared/adminSettings";
import type { ProviderLane } from "../core/providers/provider-interface";

/**
 * Translate the plain-English voice settings into concrete
 * generation parameters (temperature / maxTokens / topP) that the
 * providers pass into the model call.
 *
 * This is the "wire underlying → runtime effect" half of the
 * voice-settings work — the prompt fragment already tells the model
 * HOW to talk, this tells the model runtime HOW MUCH latitude to
 * give it.
 *
 * Kept as a pure function so it's easy to test and to reason about:
 * given (voice, lane), you always get the same numbers.
 */

interface DerivedGenerationParams {
  temperature: number;
  maxTokens: number;
  topP: number;
}

/** Base temperature per tone. Higher = more variety / creativity. */
const TONE_TEMPERATURE: Record<VoiceSettings["tone"], number> = {
  warm: 0.85,
  balanced: 0.65,
  direct: 0.45,
  playful: 0.9,
};

/** Base max_tokens per user-selected response length. */
const LENGTH_MAX_TOKENS: Record<VoiceSettings["responseLength"], number> = {
  concise: 800,
  balanced: 2500,
  thorough: 6000,
};

/**
 * Lanes that produce structured briefs or long analyses need more
 * headroom than conversational chat. Multipliers are applied on top
 * of the response-length base.
 */
const LANE_MAX_TOKEN_MULTIPLIER: Record<ProviderLane, number> = {
  chat: 1.0,
  manager: 1.0,
  operations: 1.0,
  research: 1.5, // research briefs
  business: 1.35, // strategic outputs
  finance: 1.35, // strategy / analysis
  strategy: 1.5, // cross-domain strategy / high-context planning
  admin: 1.2, // diagnostics and configuration answers
};

export function deriveGenerationParams(
  voice: VoiceSettings,
  lane: ProviderLane = "chat",
): DerivedGenerationParams {
  // Temperature: start from the tone, nudge down as formality rises.
  // A more formal setting rewards precision over variety, so temp
  // creeps down from the tone base by up to ~0.1 at max formality.
  const toneBase = TONE_TEMPERATURE[voice.tone];
  const formalityShift = ((voice.formality - 50) / 500) * -1; // -0.1 .. +0.1
  const temperature = clamp(toneBase + formalityShift, 0.1, 1.5);

  // maxTokens: response-length base * lane multiplier. If the user
  // asked to "show reasoning by default" we bump max slightly so the
  // model has room to include the why.
  const lengthBase = LENGTH_MAX_TOKENS[voice.responseLength];
  const laneMultiplier = LANE_MAX_TOKEN_MULTIPLIER[lane] ?? 1.0;
  const reasoningBonus = voice.showReasoning ? 1.15 : 1.0;
  const maxTokens = Math.round(lengthBase * laneMultiplier * reasoningBonus);

  // topP left as a moderate default. This isn't a knob the user
  // controls, but exposing it means providers still get a value
  // instead of relying on whatever the upstream default happens to be.
  const topP = 0.9;

  return { temperature: round2(temperature), maxTokens, topP };
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
