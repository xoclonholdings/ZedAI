import { useEffect, useState } from "react";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Conversation } from "@shared/schema";

function formatDate(value?: string | Date | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ArchivedChatsSettings() {
  const queryClient = useQueryClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadArchived() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/conversations/archived", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to load archived chats");
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load archived chats");
    } finally {
      setLoading(false);
    }
  }

  async function restoreConversation(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/conversations/${id}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to restore chat");
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      await loadArchived();
      setMessage("Chat restored.");
    } catch (error: any) {
      setMessage(error?.message || "Failed to restore chat");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteConversation(id: string) {
    const confirmed = window.confirm("Permanently delete this archived chat? This cannot be undone.");
    if (!confirmed) return;

    setBusyId(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete chat");
      await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      await loadArchived();
      setMessage("Archived chat deleted.");
    } catch (error: any) {
      setMessage(error?.message || "Failed to delete chat");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    void loadArchived();
  }, []);

  return (
    <Card className="zed-glass border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-orange-400" />
          Archived Chats
        </CardTitle>
        <CardDescription>
          Restore archived conversations back to the sidebar or permanently delete old ones.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {message && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground">
            {message}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={loadArchived} disabled={loading} className="border-white/10">
          {loading ? "Refreshing..." : "Refresh Archived Chats"}
        </Button>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading archived chats...</p>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
            No archived conversations yet.
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <div key={conversation.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {conversation.title || "Untitled chat"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="border-orange-400/20 text-orange-300">
                        Archived
                      </Badge>
                      <span>Updated {formatDate(conversation.updatedAt)}</span>
                    </div>
                    {conversation.preview && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {conversation.preview}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => restoreConversation(conversation.id)}
                      disabled={busyId === conversation.id}
                      className="h-8 w-8 border-white/10"
                      title="Restore chat"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteConversation(conversation.id)}
                      disabled={busyId === conversation.id}
                      className="h-8 w-8"
                      title="Delete permanently"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
