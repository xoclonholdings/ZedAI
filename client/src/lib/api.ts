// Vite: declare import.meta.env type for TS
interface ImportMetaEnv {
  VITE_API_URL?: string;
}
interface ImportMeta {
  env: ImportMetaEnv;
}


const API_URL = import.meta.env.VITE_API_URL;

export async function sendMessage(message: string) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  return res.json();
}
