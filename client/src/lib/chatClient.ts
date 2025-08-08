


// Health check
export async function streamChat(message:string, onToken:(t:string)=>void, signal?:AbortSignal){
  const API = import.meta.env.DEV && location.hostname==='localhost'
    ? 'http://localhost:5001'
    : (import.meta.env.VITE_API_BASE_URL || 'https://www.zebulonhub.xyz');
  const auth = import.meta.env.VITE_AUTH_SECRET || '';
  const res = await fetch(`${API}/api/ask`, {
    method:'POST',
    headers:{'Content-Type':'application/json', ...(auth?{Authorization:`Bearer ${auth}`}:{})},
    body: JSON.stringify({message}),
    signal
  });
  if(!res.ok) throw new Error(`API ${res.status} ${res.statusText}`);
  if(!res.body) throw new Error('No stream from server');
  const reader = res.body.getReader(); const dec = new TextDecoder();
  while(true){ const {value, done} = await reader.read(); if(done) break; onToken(dec.decode(value, {stream:true})); }
}
