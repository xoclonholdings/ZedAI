export function getSession() {
  // TODO: Implement real session logic
  return { user: null };
}

export function isLoggedIn(session: any) {
  return !!session?.user;
}
