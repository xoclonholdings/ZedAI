// Provider health checks and resolver for ZED chat

export async function pingOllama(url = 'http://localhost:11434', timeout = 1500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(`${url}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function pingOpenAI(apiKey = process.env.OPENAI_API_KEY, timeout = 1500): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function resolveProvider(prefer: 'ollama' | 'openai' = 'ollama') {
  if (prefer === 'ollama') {
    if (await pingOllama()) return { provider: 'ollama' };
    if (await pingOpenAI()) return { provider: 'openai' };
  } else {
    if (await pingOpenAI()) return { provider: 'openai' };
    if (await pingOllama()) return { provider: 'ollama' };
  }
  return null;
}
