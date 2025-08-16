// Adaptive learning for ZedAI
let internalState = [];
export function updateState(input, response) {
    internalState.push(`User: ${input}`);
    internalState.push(`ZED: ${response}`);
}
export function getContext() {
    return internalState.slice(-4).join('\n');
}
//# sourceMappingURL=adaptiveLearning.js.map