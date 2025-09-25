"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const API_URL = 'http://localhost:8080';
const turns = [
    "Hello ZED!",
    "What did I just say to you?",
    "Tell me a joke.",
    "What was the joke I asked for earlier?",
    "If I asked you to repeat the first thing I said, what would you say?",
    "What is 2 + 2?",
    "If you remember, what was my last math question?",
    "Can you summarize everything I have asked so far?",
    "Now, using all previous context, solve: If I asked for a joke and a math fact, what would you reply?",
    "Finally, what was the most complex question I asked you today?"
];
for (let i = 0; i < 50; i++) {
    turns.push(`Turn ${i + 11}: What is ${i} + ${i + 1}?`);
}
async function runTest() {
    let memoryLog = [];
    for (let i = 0; i < turns.length; i++) {
        const input = turns[i];
        const aiRes = await (0, node_fetch_1.default)(`${API_URL}/ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input })
        }).then((r) => r.json());
        const reasonRes = await (0, node_fetch_1.default)(`${API_URL}/reason`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: input })
        }).then((r) => r.json());
        memoryLog.push({ turn: i + 1, input, ai: aiRes.response, reason: reasonRes.response });
        console.log(`Turn ${i + 1}: ${input}\nAI: ${aiRes.response}\nReason: ${reasonRes.response}\n---`);
    }
    // Validate memory
    const mem = await (0, node_fetch_1.default)(`${API_URL}/memory`).then((r) => r.json());
    console.log('Final Memory Log:', mem.history);
}
runTest();
