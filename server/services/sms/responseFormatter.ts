const INTERNAL_LEAKAGE = [
  /\bsystem prompt\b/i,
  /\bdeveloper message\b/i,
  /\bexecutionTrace\b/i,
  /\bknowledgePrompt\b/i,
  /<\/?(?:system|developer|assistant|tool)>/i,
  /^\s*\{\s*"(?:reply|metadata|trace|agent)"/i,
];

export function containsInternalLeakage(value: string): boolean {
  return INTERNAL_LEAKAGE.some((pattern) => pattern.test(value));
}

export function formatSmsReply(value: string): string {
  const cleaned = String(value || "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, "").replace(/```/g, ""))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned || containsInternalLeakage(cleaned)) {
    return "I couldn't safely format that for text. Open ZAR to continue securely.";
  }
  return cleaned;
}

export function segmentSms(value: string, maxLength = 1450): string[] {
  const text = formatSmsReply(value);
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;
  const bodyLimit = Math.max(100, maxLength - 12);
  while (remaining.length > bodyLimit) {
    const window = remaining.slice(0, bodyLimit + 1);
    const candidates = [window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("; "), window.lastIndexOf(" ")];
    const splitAt = Math.max(...candidates);
    const end = splitAt > bodyLimit * 0.55 ? splitAt + (window[splitAt] === "." || window[splitAt] === ";" ? 1 : 0) : bodyLimit;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks.map((chunk, index) => `(${index + 1}/${chunks.length}) ${chunk}`);
}
