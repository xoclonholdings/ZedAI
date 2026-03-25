export type LocalSessionUser = {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
};

const SESSION_KEY = "zed-local-session";

export function setLocalSession(user: LocalSessionUser) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      user,
      authenticated: true,
      timestamp: Date.now(),
    })
  );
}

export function getLocalSession(): LocalSessionUser | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.authenticated ? parsed.user : null;
  } catch {
    return null;
  }
}

export function clearLocalSession() {
  localStorage.removeItem(SESSION_KEY);
} 