"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTurn = saveTurn;
exports.getHistory = getHistory;
// Persistent memory module for ZedAI
// Stores and retrieves conversation turns
let history = [];
function saveTurn(user, ai) {
    history.push({ user, ai });
}
function getHistory() {
    return history;
}
