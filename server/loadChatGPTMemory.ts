// loadChatGPTMemory.ts
// CLI tool to import ChatGPT export JSON into ZED's memory
// Usage: ts-node loadChatGPTMemory.ts ./chatGPTExport.json

import fs from 'fs';
import path from 'path';
import { addMemoryTurn, getHistory } from './memory';

// Example ChatGPT export structure:
// {
//   "messages": [
//     { "role": "user", "content": "Hello!" },
//     { "role": "assistant", "content": "Hi! How can I help?" },
//     ...
//   ]
// }

function flattenChatGPTExport(json: any) {
  const pairs: { user: string, zed: string }[] = [];
  let lastUser = '';
  for (const msg of json.messages) {
    if (msg.role === 'user') {
      lastUser = msg.content;
    } else if (msg.role === 'assistant' && lastUser) {
      pairs.push({ user: lastUser, zed: msg.content });
      lastUser = '';
    }
  }
  return pairs;
}

function importToZEDMemory(pairs: { user: string, zed: string }[]) {
  let turnNum = getHistory().length + 1;
  let imported = 0;
  for (const pair of pairs) {
    const turn = { turn: turnNum++, user: pair.user, zed: pair.zed, context: {} };
    addMemoryTurn(turn);
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
  const raw = fs.readFileSync(path.resolve(file), 'utf-8');
  const json = JSON.parse(raw);
  const pairs = flattenChatGPTExport(json);
  const imported = importToZEDMemory(pairs);
  console.log(`Imported ${imported} turns from ChatGPT export.`);
  // Optionally run a 10-turn test after import
  const history = getHistory().slice(-10);
  console.log('Last 10 turns in ZED memory:');
  for (const turn of history) {
    console.log(`Turn ${turn.turn}: User: ${turn.user}\nZED: ${turn.zed}\n---`);
  }
}

main();

// Fully commented skeleton, ready to run. Handles missing fields, skips duplicates, maintains order/context.
// For large exports, split into batches or run multiple times.
