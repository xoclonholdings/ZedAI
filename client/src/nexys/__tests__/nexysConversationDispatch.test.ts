import test from "node:test";
import assert from "node:assert/strict";

import { sendAgentMessage } from "../../components/chat/chat-area/sendAgentMessage";
import { extractNexysClientActions } from "../actions/NexysClientActions";
import type { Message } from "@shared/schema";

test("Nexys communication dispatch preserves prompts and exposes structured client actions", async () => {
  const originalFetch = globalThis.fetch;
  const capturedBodies: unknown[] = [];
  const responses: unknown[] = [];
  let streaming = false;
  let messages: Message[] = [];

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBodies.push(JSON.parse(String(init?.body || "{}")));
    return new Response(JSON.stringify({
      reply: "I can take you there and keep this conversation open.",
      metadata: {
        nexysClientActions: [{ type: "focus-node", nodeId: "memory" }],
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await sendAgentMessage({
      message: "Take me to Memory and show me what you retained from yesterday.",
      convId: "conversation-1",
      setIsStreaming: (value) => {
        streaming = typeof value === "function" ? value(streaming) : value;
      },
      setLocalMessages: (value) => {
        messages = typeof value === "function" ? value(messages) : value;
      },
      queryClient: {
        invalidateQueries: () => undefined,
      } as any,
      onResponse: (data) => responses.push(data),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(capturedBodies.length, 1);
  assert.deepEqual(capturedBodies[0], {
    message: "Take me to Memory and show me what you retained from yesterday.",
    conversationId: "conversation-1",
  });
  assert.equal(streaming, false);
  assert.equal(messages.some((message) => message.role === "user" && message.content.includes("Take me to Memory")), true);
  assert.equal(messages.some((message) => message.role === "assistant" && message.content.includes("conversation open")), true);
  assert.deepEqual(extractNexysClientActions(responses[0]), [
    { type: "focus-node", nodeId: "memory" },
  ]);
});
