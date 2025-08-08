// Centralized streaming chat client for ZED
// Handles SSE/NDJSON, timeout, abort, and robust error handling

export async function streamChatAPI({
  messages,
  requestId,
  signal,
  timeoutMs = 12000,
}: {
  messages: any[];
  requestId: string;
  signal: AbortSignal;
  timeoutMs?: number;
}): Promise<AsyncGenerator<string, void, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const mergedSignal = new AbortController();
  signal.addEventListener('abort', () => mergedSignal.abort());
  controller.signal.addEventListener('abort', () => mergedSignal.abort());

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, requestId }),
    signal: mergedSignal.signal,
  });
  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let done = false;

  async function* gen() {
    try {
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        // Parse SSE/NDJSON lines
        let lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue; // heartbeat
          if (line.includes('[DONE]')) {
            done = true;
            yield '[DONE]';
            return;
          }
          yield line;
        }
      }
    } finally {
      clearTimeout(timeout);
      reader.releaseLock();
    }
  }
  return gen();
}
