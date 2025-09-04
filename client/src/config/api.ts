import { getServerPort } from './ports';

export async function getApiUrl() {
  const port = await getServerPort();
  return `http://localhost:${port}/api`;
}

export const API_CONFIG = {
  endpoints: {
    chat: '/chat',
    health: '/health',
    reason: '/reason'
  },
  headers: {
    'Content-Type': 'application/json'
  }
};
