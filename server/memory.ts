// Persistent memory module for ZedAI
// Stores and retrieves conversation turns
// ZED memory structure: { turn: number, user: string, zed: string, context?: object }

let history: { turn: number, user: string, zed: string, context?: object }[] = [];

export function saveTurn(user: string, ai: string) {
  history.push({ turn: history.length + 1, user, zed: ai });
}

export function getHistory(): { turn: number, user: string, zed: string, context?: object }[] {
  return history;
}

// Add a full memory turn (for import)
export function addMemoryTurn(turn: { turn: number, user: string, zed: string, context?: object }) {
  // Skip duplicates (by turn number and user/zed text)
  if (history.some(h => h.turn === turn.turn && h.user === turn.user && h.zed === turn.zed)) return;
  history.push(turn);
}
