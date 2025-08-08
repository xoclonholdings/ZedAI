import { streamChat } from "@/lib/ai/router";
import { getSession } from "@/lib/auth/session";

export const runtime = "edge";

export async function POST(req: Request) {
  const { messages, mode } = await req.json();
  const session = getSession();
  const user = session.user;
  const chatMode = user ? mode : "regular";
  const stream = streamChat({ messages, mode: chatMode, user });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async pull(controller) {
      for await (const token of stream) {
        controller.enqueue(encoder.encode(token));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
