import { getServerPort } from './ports';

export async function getApiUrl() {
  // Use fixed port 5000 for development
  const port = process.env.NODE_ENV === 'development' ? 5000 : await getServerPort();
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
