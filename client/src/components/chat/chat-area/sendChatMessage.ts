import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import { notifyMessage } from "@/lib/notify";
import type { Message } from "@shared/schema";

interface SendChatMessageArgs {
  message: string;
  convId: string;
  abortRef: MutableRefObject<AbortController | null>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setStreamingMessage: Dispatch<SetStateAction<string>>;
  setLocalMessages: Dispatch<SetStateAction<Message[]>>;
  queryClient: QueryClient;
}

/**
 * Streams a chat-mode message over Server-Sent Events. Optimistically
 * shows the user's turn, accumulates the assistant tokens into the
 * streaming buffer, then commits both turns to local state on `done`.
 *
 * Errors surface as a synthetic assistant reply so the user always
 * sees *something* rather than a silently dead composer.
 */
export async function sendChatMessage({
  message,
  convId,
  abortRef,
  setIsStreaming,
  setStreamingMessage,
  setLocalMessages,
  queryClient,
}: SendChatMessageArgs) {
  abortRef.current?.abort();
  abortRef.current = new AbortController();

  setIsStreaming(true);
  setStreamingMessage("");

  const tempUser: Message = {
    id: `temp-user-${Date.now()}`,
    conversationId: convId,
    role: "user",
    content: message,
    metadata: null,
    createdAt: new Date(),
  };
  setLocalMessages((prev) => [...prev, tempUser]);

  try {
    const res = await fetch(`/api/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: message, stream: true }),
      signal: abortRef.current.signal,
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}${
          detail ? ` — ${detail.slice(0, 200)}` : ""
        }`,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let aiContent = "";
    let userMessageFromServer: Message | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split("\n");
      buf = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === "user_message") {
            userMessageFromServer = data.message;
          } else if (data.type === "token") {
            aiContent += data.token;
            setStreamingMessage(aiContent);
          } else if (data.type === "done" || data.type === "error") {
            const aiMessage: Message = data.message;
            setStreamingMessage("");
            setIsStreaming(false);
            setLocalMessages((prev) => {
              const withoutTemp = prev.filter((m) => m.id !== tempUser.id);
              return [...withoutTemp, userMessageFromServer || tempUser, aiMessage];
            });
            if (data.type === "done" && aiMessage?.content) {
              notifyMessage("ZED", aiMessage.content);
            }
            queryClient.invalidateQueries({
              queryKey: ["/api/conversations", convId, "messages"],
            });
            queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
          }
        } catch {
          /* malformed SSE frame; skip and keep reading */
        }
      }
    }
  } catch (err: any) {
    if (err?.name === "AbortError") return;
    console.error("[Chat] SSE error:", err);
    setStreamingMessage("");
    setIsStreaming(false);
    const detail = err?.message || "unknown error";
    const isAuthLike = /HTTP 40[1234]/.test(detail);
    const friendly = isAuthLike
      ? `${detail}. Try signing in again — your session may have expired.`
      : `Chat request failed: ${detail}`;
    setLocalMessages((prev) => [
      ...prev,
      {
        id: `err-${Date.now()}`,
        conversationId: convId,
        role: "assistant",
        content: friendly,
        metadata: null,
        createdAt: new Date(),
      },
    ]);
  }
}
