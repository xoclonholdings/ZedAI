import fetch from 'node-fetch';

const API_URL = 'http://localhost:8080';

const turns: string[] = [
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
  turns.push(`Turn ${i+11}: What is ${i} + ${i+1}?`);
}

type AIResponse = { response: string };
type MemoryResponse = { history: { user: string, ai: string }[] };

async function runTest() {
  let memoryLog: any[] = [];
  for (let i = 0; i < turns.length; i++) {
    const input = turns[i];
    const aiRes: AIResponse = await fetch(`${API_URL}/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    }).then((r: any) => r.json());
    const reasonRes: AIResponse = await fetch(`${API_URL}/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: input })
    }).then((r: any) => r.json());
    memoryLog.push({ turn: i+1, input, ai: aiRes.response, reason: reasonRes.response });
    console.log(`Turn ${i+1}: ${input}\nAI: ${aiRes.response}\nReason: ${reasonRes.response}\n---`);
  }
  // Validate memory
  const mem: MemoryResponse = await fetch(`${API_URL}/memory`).then((r: any) => r.json());
  console.log('Final Memory Log:', mem.history);
}

runTest();
