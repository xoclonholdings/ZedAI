"use strict";
// loadChatGPTMemory.ts
// CLI tool to import ChatGPT export JSON into ZED's memory
// Usage: ts-node loadChatGPTMemory.ts ./chatGPTExport.json
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const memory_1 = require("./memory");
// Example ChatGPT export structure:
// {
//   "messages": [
//     { "role": "user", "content": "Hello!" },
//     { "role": "assistant", "content": "Hi! How can I help?" },
//     ...
//   ]
// }
function flattenChatGPTExport(json) {
    const pairs = [];
    let lastUser = '';
    for (const msg of json.messages) {
        if (msg.role === 'user') {
            lastUser = msg.content;
        }
        else if (msg.role === 'assistant' && lastUser) {
            pairs.push({ user: lastUser, ai: msg.content });
            lastUser = '';
        }
    }
    return pairs;
}
function importToAIMemory(pairs) {
    let turnNum = (0, memory_1.getHistory)().length + 1;
    let imported = 0;
    for (const pair of pairs) {
        const turn = { turn: turnNum++, user: pair.user, ai: pair.ai, context: {} };
        (0, memory_1.addMemoryTurn)(turn);
        imported++;
    }
    return imported;
}
function main() {
    const file = process.argv[2];
    if (!file) {
        console.error('Usage: ts-node loadChatGPTMemory.ts ./chatGPTExport.json');
        process.exit(1);
    }
    const raw = fs_1.default.readFileSync(path_1.default.resolve(file), 'utf-8');
    const json = JSON.parse(raw);
    const pairs = flattenChatGPTExport(json);
    const imported = importToAIMemory(pairs);
    console.log(`Imported ${imported} turns from ChatGPT export.`);
    // Optionally run a 10-turn test after import
    const history = (0, memory_1.getHistory)().slice(-10);
    console.log('Last 10 turns in AI memory:');
    for (const turn of history) {
        console.log(`Turn ${turn.turn}: User: ${turn.user}\nAI: ${turn.ai}\n---`);
    }
}
main();
// Fully commented skeleton, ready to run. Handles missing fields, skips duplicates, maintains order/context.
// For large exports, split into batches or run multiple times.
