import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Conversation, ConversationMode } from "@shared/schema";

/**
 * Conversation-scoped mutations: switch chat/agent mode, rename, and
 * the "first-message auto-title" rule used to upgrade a generic "New
 * Chat" title into the first ~8 words the user typed.
 */
export function useConversationMutations(conversation?: Conversation, conversationId?: string) {
  const queryClient = useQueryClient();

  const updateModeMutation = useMutation({
    mutationFn: async (mode: ConversationMode) => {
      if (!conversationId) return null;
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error("Failed to update mode");
      return res.json();
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
      }
    },
  });

  const renameConversationMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to rename conversation");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", vars.id] });
    },
  });

  async function ensureConversationTitle(convId: string, message: string) {
    const rawTitle = (conversation?.title || "").trim().toLowerCase();
    const shouldRename =
      !conversation ||
      !conversation.title ||
      rawTitle === "new chat" ||
      rawTitle === "new conversation" ||
      rawTitle === "hello";

    if (!shouldRename) return;

    const title = message
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 8)
      .join(" ");

    if (title) {
      await renameConversationMutation.mutateAsync({ id: convId, title });
    }
  }

  return { updateModeMutation, ensureConversationTitle };
}
