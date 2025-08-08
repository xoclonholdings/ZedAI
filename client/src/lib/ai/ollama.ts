// Streamed fetch helper for Ollama
export async function* streamOllama({ messages }: { messages: any[] }) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += new TextDecoder().decode(value);
    // Assume tokens are separated by space or newline
    for (const token of buffer.split(/\s+/)) {
      if (token) yield token + ' ';
    }
    buffer = '';
  }
}
