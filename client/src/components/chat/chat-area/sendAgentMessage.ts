import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";

import type { AgentTarget, Message } from "@shared/schema";

interface SendAgentMessageArgs {
  message: string;
  convId: string;
  agentTarget?: AgentTarget;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setLocalMessages: Dispatch<SetStateAction<Message[]>>;
  queryClient: QueryClient;
}

/**
 * Primary ZED dispatch: posts to /api/orchestrate and lets the server
 * select agents, tools, memory, approvals, and optional flow suggestions.
 * A legacy agentTarget can still be supplied by older surfaces, but the
 * main chat UI intentionally omits it so users talk to ZED, not lanes.
 */
export async function sendAgentMessage({
  message,
  convId,
  agentTarget,
  setIsStreaming,
  setLocalMessages,
  queryClient,
}: SendAgentMessageArgs) {
  setIsStreaming(true);

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
    const payload: Record<string, unknown> = { message, conversationId: convId };
    if (agentTarget) payload.targetAgent = agentTarget;

    const res = await fetch("/api/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    let replyContent: string;
    if (!res.ok) {
      const isAuthLike = res.status === 401 || res.status === 403;
      replyContent = isAuthLike
        ? `Session expired (HTTP ${res.status}). Please sign in again.`
        : data?.reply ||
          data?.error ||
          `ZED request failed: HTTP ${res.status} ${res.statusText || ""}`.trim();
    } else {
      replyContent = data?.reply || data?.error || "No response";
    }

    setLocalMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempUser.id);
      return [
        ...withoutTemp,
        { ...tempUser, id: `user-${Date.now()}` },
        {
          id: `agent-${Date.now()}`,
          conversationId: convId,
          role: "assistant" as const,
          content: replyContent,
          metadata: { agent: data?.agent || "ManagerAgent" },
          createdAt: new Date(),
        },
      ];
    });

    queryClient.invalidateQueries({
      queryKey: ["/api/conversations", convId, "messages"],
    });
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
  } catch (err: any) {
    console.error("[ZED] Error:", err);
    setLocalMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempUser.id);
      return [
        ...withoutTemp,
        { ...tempUser, id: `user-${Date.now()}` },
        {
          id: `agent-err-${Date.now()}`,
          conversationId: convId,
          role: "assistant" as const,
          content: `ZED request failed: ${err?.message || "network error"}`,
          metadata: { agent: "ManagerAgent" },
          createdAt: new Date(),
        },
      ];
    });
  } finally {
    setIsStreaming(false);
  }
}
