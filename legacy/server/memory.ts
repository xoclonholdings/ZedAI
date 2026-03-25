// Persistent memory module for ZedAI
// Stores and retrieves conversation turns

// AI memory structure: { turn: number, user: string, ai: string, context?: object }
let history: { turn: number, user: string, ai: string, context?: object }[] = [];

export function saveTurn(user: string, ai: string) {
  history.push({ turn: history.length + 1, user, ai });
}

export function getHistory(): { turn: number, user: string, ai: string, context?: object }[] {
  return history;
}

// Add a full memory turn (for import)
export function addMemoryTurn(turn: { turn: number, user: string, ai: string, context?: object }) {
  // Skip duplicates (by turn number and user/ai text)
  if (history.some(h => h.turn === turn.turn && h.user === turn.user && h.ai === turn.ai)) return;
  history.push(turn);
}
