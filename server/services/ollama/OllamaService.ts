const OLLAMA_URL = "http://localhost:11434/api/generate";

export async function generateFromOllama(prompt: string) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3.2",
      prompt,
      stream: false,
    }),
  });

  const data = await response.json();
  return data.response;
}
