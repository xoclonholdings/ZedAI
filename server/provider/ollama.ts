import fetch from 'node-fetch';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODEL = process.env.MODEL || 'llama3';

export async function* ollamaChatStream(message: string, abortSignal: AbortSignal) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [{ role: 'user', content: message }]
    }),
    signal: abortSignal
  });

  if (!res.ok || !res.body) throw new Error('Ollama unreachable');

  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of res.body as any as AsyncIterable<Buffer>) {
    buffer += decoder.decode(chunk, { stream: true });
    let lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.message?.content) yield obj.message.content;
      } catch { /* ignore parse errors */ }
    }
  }
}
