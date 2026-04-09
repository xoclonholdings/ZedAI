export function buildOllamaPrompt(
  userInput: string,
  context?: {
    extractedContent?: string;
    memory?: string;
    history?: { role: string; content: string }[];
  }
): string {

  let prompt = "";

  // =========================
  // MEMORY
  // =========================
  if (context?.memory) {
    prompt += `MEMORY:\n${context.memory}\n\n`;
  }

  // =========================
  // FILE CONTENT
  // =========================
  if (context?.extractedContent) {
    prompt += `FILE DATA:\n${context.extractedContent.slice(0, 8000)}\n\n`;
  }

  // =========================
  // CHAT HISTORY
  // =========================
  if (context?.history && context.history.length > 0) {
    prompt += `CONVERSATION:\n`;

    for (const msg of context.history.slice(-10)) {
      prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
    }

    prompt += `\n`;
  }

  // =========================
  // USER INPUT
  // =========================
  prompt += `USER:\n${userInput}\n\nASSISTANT:`;

  return prompt;
}