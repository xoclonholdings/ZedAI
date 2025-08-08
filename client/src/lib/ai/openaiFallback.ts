// Stub fallback for OpenAI/Julius
export async function* streamOpenAIFallback() {
  yield '[OpenAI/Julius fallback] This is a streamed token.';
}
