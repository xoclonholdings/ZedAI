// Model router for ZED chat
// Streams tokens from Ollama if available, otherwise falls back to OpenAI/Julius

export async function* streamChat({ messages, mode, user }: { messages: any[]; mode: "regular" | "agent"; user: any }) {
  // Pseudocode: try Ollama first
  if (mode === "agent" && user?.isLoggedIn && user?.agentEnabled) {
    if (await ollamaAvailable()) {
      yield* ollamaStream(messages);
      return;
    }
    yield* openAIStream(messages);
    return;
  }
  // Regular chat: always try Ollama first
  if (await ollamaAvailable()) {
    yield* ollamaStream(messages);
    return;
  }
  yield* openAIStream(messages);
}

async function ollamaAvailable() {
  // TODO: Implement actual check
  return true;
}

async function* ollamaStream(_messages: any[]) {
  // TODO: Implement streaming from Ollama
  yield "[Ollama] This is a streamed token.";
}

async function* openAIStream(_messages: any[]) {
  // TODO: Implement streaming from OpenAI/Julius
  yield "[OpenAI/Julius] This is a fallback streamed token.";
}
