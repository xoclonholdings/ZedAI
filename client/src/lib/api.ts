// src/lib/api.ts
const BACKEND_URL = typeof process !== 'undefined' && process.env.VITE_API_URL ? process.env.VITE_API_URL : '/api';

export async function sendMessage(message: string) {
  const response = await fetch(`${BACKEND_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return await response.json();
}
