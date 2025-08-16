// Multi-step reasoning, math, and summarization logic for ZED
import { getHistory } from './memory';

export function reasonOverHistory(prompt: string): string {
  const history = getHistory();
  // Math logic
  const mathMatch = prompt.match(/(\d+) \+ (\d+)/);
  if (mathMatch) {
    const sum = parseInt(mathMatch[1]) + parseInt(mathMatch[2]);
    return `The answer is ${sum}.`;
  }
  // Joke recall
  if (/joke/i.test(prompt)) {
    const jokeTurn = history.find(t => t.user.toLowerCase().includes('joke'));
    return jokeTurn ? jokeTurn.ai : 'No joke found in memory.';
  }
  // Summarization
  if (/summarize|summary/i.test(prompt)) {
    return history.map((t, i) => `Turn ${i+1}: User: ${t.user} | ZED: ${t.ai}`).join('\n');
  }
  // Context/multi-step
  if (/combine|context|multi-step/i.test(prompt)) {
    const lastTwo = history.slice(-2);
    return lastTwo.map(t => `${t.user} => ${t.ai}`).join(' | ');
  }
  // Recall first turn
  if (/first thing/i.test(prompt)) {
    return history[0] ? history[0].user : 'No memory of first turn.';
  }
  // Recall last math question
  if (/last math/i.test(prompt)) {
    const mathTurn = history.reverse().find(t => /\d+ \+ \d+/.test(t.user));
    return mathTurn ? mathTurn.user : 'No math question found.';
  }
  // Most complex question
  if (/most complex/i.test(prompt)) {
    return history.reduce((max, t) => t.user.length > max.length ? t.user : max, '');
  }
  return 'Reasoning not implemented for this prompt.';
}
