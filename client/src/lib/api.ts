// Vite: declare import.meta.env type for TS
interface ImportMetaEnv {
  VITE_API_URL?: string;
}
interface ImportMeta {
  env: ImportMetaEnv;
}

const BACKEND_URL = process.env.VITE_API_URL || 'http://localhost:5000';

export async function sendMessage(message: string) {
  const response = await fetch(`${BACKEND_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return await response.json();
}
