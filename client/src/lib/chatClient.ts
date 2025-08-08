
// Environment-based API base URL
const API_BASE_URL = import.meta.env.DEV
  ? "http://localhost:5001"
  : (import.meta.env.VITE_API_BASE_URL || "");

export async function streamChat(
  message: string,
  token: string,
  onToken: (t: string) => void,
  options?: { signal?: AbortSignal }
) {
  const controller = options?.signal ? undefined : new AbortController();
  const signal = options?.signal || controller?.signal;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message }),
      signal
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request was aborted.');
    }
    throw new Error('Network error. Please check your connection.');
  }

  if (!response.ok) {
    let msg = 'Network error.';
    try {
      const data = await response.json();
      msg = data?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  try {
    while (!done) {
      const { value, done: d } = await reader.read();
      if (value) onToken(decoder.decode(value));
      done = d;
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Streaming aborted by user.');
    }
    throw new Error('Error while streaming response.');
  }
}
