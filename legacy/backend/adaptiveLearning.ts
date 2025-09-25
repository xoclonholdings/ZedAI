// Adaptive learning for ZedAI
let internalState: string[] = [];
export function updateState(input: string, response: string) {
  internalState.push(`User: ${input}`);
  internalState.push(`ZED: ${response}`);
}
export function getContext(): string {
  return internalState.slice(-4).join('\n');
}
