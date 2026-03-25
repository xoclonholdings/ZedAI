// Minimal adaptive learning module
// Learns from user input and updates model/user profile
// Adaptive learning module for ZedAI
// Maintains internal state/context from user input and AI responses
let internalState = [];
export function updateState(input, response) {
    internalState.push(`User: ${input}`);
    internalState.push(`ZED: ${response}`);
}
export function getContext() {
    // Provide last 4 turns as context
    return internalState.slice(-4).join('\n');
}
