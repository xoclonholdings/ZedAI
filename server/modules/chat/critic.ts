export function simpleCritic(answer: string) {
  const flags = [];
  if (answer.length < 1) flags.push("empty");
  if (/MiniReasoner/.test(answer)) flags.push("fallback");
  return { ok: flags.length === 0, flags };
}
