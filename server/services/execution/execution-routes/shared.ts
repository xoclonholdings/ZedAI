/**
 * Pull the user id out of either the modern claims shape that
 * isAuthenticated attaches, or the older session.userId fallback.
 * Returns null when neither is present so callers can return 401
 * cleanly.
 */
export function userIdFrom(req: any): string | null {
  return req?.user?.claims?.sub || req?.session?.userId || null;
}
