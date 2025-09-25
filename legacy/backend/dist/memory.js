// Persistent memory for ZedAI
let history = [];
export function saveTurn(user, ai) {
    history.push({ user, ai });
}
export function getHistory() {
    return history;
}
//# sourceMappingURL=memory.js.map