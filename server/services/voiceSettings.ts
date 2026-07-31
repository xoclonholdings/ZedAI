import type { VoiceSettings } from "../../shared/adminSettings";

/**
 * Translate the user-facing voice settings into a compact system-
 * prompt fragment. The mapping favours short, imperative sentences
 * that steer the model without adding noise.
 *
 * Called by ZarContextBuilder on every chat / agent send, so the
 * cost of this string is paid on every message — keep it tight.
 */
export function voiceSettingsToPrompt(v: VoiceSettings): string {
  const parts: string[] = [];

  const toneCopy: Record<VoiceSettings["tone"], string> = {
    warm: "Speak with warmth and encouragement.",
    balanced: "Maintain an even, professional tone.",
    direct: "Be direct and skip softeners; get to the point.",
    playful: "Allow occasional wit and playfulness where it fits.",
  };
  parts.push(toneCopy[v.tone]);

  if (v.formality < 30) {
    parts.push("Use casual, conversational language.");
  } else if (v.formality > 70) {
    parts.push("Use polished, professional language.");
  } else {
    parts.push("Use everyday, natural language.");
  }

  const perspectiveCopy: Record<VoiceSettings["perspective"], string> = {
    partner:
      "Position yourself as a thinking partner exploring the problem alongside the user.",
    advisor:
      "Position yourself as an experienced advisor giving your best recommendation.",
    "straight-shooter":
      "Give unvarnished takes. Don't hedge. Say what you actually think.",
    "devils-advocate":
      "Actively challenge the user's assumptions and surface the strongest counter-view.",
  };
  parts.push(perspectiveCopy[v.perspective]);

  const lengthCopy: Record<VoiceSettings["responseLength"], string> = {
    concise: "Keep responses short — a few sentences, no filler.",
    balanced: "Match response length to the question's complexity.",
    thorough: "Give complete answers with worked examples where they help.",
  };
  parts.push(lengthCopy[v.responseLength]);

  parts.push(
    v.showReasoning
      ? "Include a brief 'why' after each answer."
      : "Give the result directly; don't narrate your reasoning process unless asked.",
  );

  if (v.plainLanguage) {
    parts.push("Avoid jargon and technical terms unless the user asks for them.");
  }
  if (v.codeBlocks) {
    parts.push("Wrap any code in syntax-highlighted code blocks.");
  }
  if (v.prohibitedPhrases.length > 0) {
    const list = v.prohibitedPhrases.map((p) => `"${p}"`).join(", ");
    parts.push(`Never use these phrases or patterns: ${list}.`);
  }

  return `## HOW ZAR SOUNDS\nFollow these voice rules on every response:\n${parts
    .map((p) => `  • ${p}`)
    .join("\n")}`;
}
