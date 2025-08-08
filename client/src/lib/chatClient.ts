


// Health check
export async function streamChat(message: string, onToken: (t: string) => void, signal?: AbortSignal) {
  // Use public backend URL if not localhost
  const API = import.meta.env.DEV && location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : (import.meta.env.VITE_API_BASE_URL || 'https://www.zebulonhub.xyz');
  const auth = import.meta.env.VITE_AUTH_SECRET || '';
  let res: Response;
  try {
    res = await fetch(`${API}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify({ content: message }),
      signal
    });
  } catch (err) {
    throw new Error('Failed to fetch backend: ' + (err instanceof Error ? err.message : String(err)));
  }
  if (!res.ok) {
    let errMsg = `API ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.error) errMsg += `: ${errJson.error}`;
    } catch {}
    throw new Error(errMsg);
  }
  if (!res.body) throw new Error('No stream from server');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    onToken(dec.decode(value, { stream: true }));
  }
}
