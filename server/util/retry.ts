export async function withBackoff<T>(fn: () => Promise<T>, tries = 3, base = 300): Promise<T> {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) {
        const jitter = Math.floor(Math.random() * base);
        await new Promise(res => setTimeout(res, base * Math.pow(2, i) + jitter));
      }
    }
  }
  throw lastErr;
}
