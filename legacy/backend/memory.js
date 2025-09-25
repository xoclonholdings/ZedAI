"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTurn = saveTurn;
exports.getHistory = getHistory;
// Persistent memory for ZedAI
let history = [];
function saveTurn(user, ai) {
    history.push({ user, ai });
}
function getHistory() {
    return history;
}
//# sourceMappingURL=memory.js.map