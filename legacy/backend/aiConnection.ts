// AI connection for ZedAI
import { getContext } from './adaptiveLearning.js';
import { getHistory } from './memory.js';
export async function getAIResponse(input: string): Promise<string> {
  const context = getContext();
  const history = getHistory();
  if (input.toLowerCase().includes('joke')) return 'Why did the AI cross the road? To optimize its neural net!';
  if (input.toLowerCase().includes('meaning of life')) return 'The meaning of life is to learn, grow, and help others.';
  if (input.toLowerCase().includes('goodbye')) return 'Goodbye! Have a great day.';
  if (input.toLowerCase().includes('hello')) return 'Hello! I am ZED, your AI assistant.';
  if (input.toLowerCase().includes('how are you')) return 'I am just code, but I am here to help you!';
  return 'AI response with memory and context.';
}
