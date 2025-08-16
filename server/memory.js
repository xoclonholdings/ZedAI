// Persistent memory module for ZedAI
// Stores and retrieves conversation turns
// AI memory structure: { turn: number, user: string, ai: string, context?: object }
let history = [];
export function saveTurn(user, ai) {
    history.push({ turn: history.length + 1, user, ai });
}
export function getHistory() {
    return history;
}
// Add a full memory turn (for import)
export function addMemoryTurn(turn) {
    // Skip duplicates (by turn number and user/ai text)
    if (history.some(h => h.turn === turn.turn && h.user === turn.user && h.ai === turn.ai))
        return;
    history.push(turn);
}
