"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateState = updateState;
exports.getContext = getContext;
// Adaptive learning for ZedAI
let internalState = [];
function updateState(input, response) {
    internalState.push(`User: ${input}`);
    internalState.push(`ZED: ${response}`);
}
function getContext() {
    return internalState.slice(-4).join('\n');
}
//# sourceMappingURL=adaptiveLearning.js.map