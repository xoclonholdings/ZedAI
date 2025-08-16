// Persistent memory for ZedAI
let history: {user: string, ai: string}[] = [];
export function saveTurn(user: string, ai: string) {
  history.push({ user, ai });
}
export function getHistory(): {user: string, ai: string}[] {
  return history;
}
