"use strict";
// Persistent memory module for ZedAI
// Stores and retrieves conversation turns
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTurn = saveTurn;
exports.getHistory = getHistory;
exports.addMemoryTurn = addMemoryTurn;
// AI memory structure: { turn: number, user: string, ai: string, context?: object }
let history = [];
function saveTurn(user, ai) {
    history.push({ turn: history.length + 1, user, ai });
}
function getHistory() {
    return history;
}
// Add a full memory turn (for import)
function addMemoryTurn(turn) {
    // Skip duplicates (by turn number and user/ai text)
    if (history.some(h => h.turn === turn.turn && h.user === turn.user && h.ai === turn.ai))
        return;
    history.push(turn);
}
