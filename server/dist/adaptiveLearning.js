"use strict";
// Minimal adaptive learning module
// Learns from user input and updates model/user profile
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateState = updateState;
exports.getContext = getContext;
// Adaptive learning module for ZedAI
// Maintains internal state/context from user input and AI responses
let internalState = [];
function updateState(input, response) {
    internalState.push(`User: ${input}`);
    internalState.push(`ZED: ${response}`);
}
function getContext() {
    // Provide last 4 turns as context
    return internalState.slice(-4).join('\n');
}
