"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIResponse = getAIResponse;
// AI connection for ZedAI
const adaptiveLearning_1 = require("./adaptiveLearning");
const memory_1 = require("./memory");
async function getAIResponse(input) {
    const context = (0, adaptiveLearning_1.getContext)();
    const history = (0, memory_1.getHistory)();
    if (input.toLowerCase().includes('joke'))
        return 'Why did the AI cross the road? To optimize its neural net!';
    if (input.toLowerCase().includes('meaning of life'))
        return 'The meaning of life is to learn, grow, and help others.';
    if (input.toLowerCase().includes('goodbye'))
        return 'Goodbye! Have a great day.';
    if (input.toLowerCase().includes('hello'))
        return 'Hello! I am ZED, your AI assistant.';
    if (input.toLowerCase().includes('how are you'))
        return 'I am just code, but I am here to help you!';
    return 'AI response with memory and context.';
}
//# sourceMappingURL=aiConnection.js.map