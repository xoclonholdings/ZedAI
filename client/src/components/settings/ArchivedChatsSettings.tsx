import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import type { Conversation } from "@shared/schema";

import {
  SaveIndicator,
  SettingGroup,
  SettingRow,
} from "@/components/admin/sections/settings/atoms";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function friendlyTime(value?: string | Date | null): string {
  if (!value) return "unknown";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - d.getTime()) / 86400000);
    if (diffDays < 1) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return String(value);
  }
}

export default function ArchivedChatsSettings() {
  const queryClient = useQueryClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadArchived = useCallback(async () => {
    setLoading(true);
    setErrorMessage(undefined);
    try {
      const res = await fetch("/api/conversations/archived", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err: any) {
      setErrorMessage(err?.message);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchived();
  }, [loadArchived]);

  const restore = useCallback(
    async (id: string) => {
      setBusyId(id);
      setStatus("saving");
      try {
        const res = await fetch(`/api/conversations/${id}/restore`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Restore failed (${res.status})`);
        await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        await loadArchived();
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1500);
      } catch (err: any) {
        setErrorMessage(err?.message);
        setStatus("error");
      } finally {
        setBusyId(null);
      }
    },
    [queryClient, loadArchived],
  );

  const remove = useCallback(
    async (id: string, title?: string | null) => {
      const name = title || "this chat";
      if (!window.confirm(`Delete "${name}" for good? This cannot be undone.`)) return;
      setBusyId(id);
      setStatus("saving");
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Delete failed (${res.status})`);
        await queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        await loadArchived();
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1500);
      } catch (err: any) {
        setErrorMessage(err?.message);
        setStatus("error");
      } finally {
        setBusyId(null);
      }
    },
    [queryClient, loadArchived],
  );

  const header = useMemo(
    () => (
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Archived chats
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            Chats you've hidden from the sidebar. Bring one back to the sidebar, or delete it for good.
          </p>
        </div>
        <SaveIndicator status={status} errorMessage={errorMessage} />
      </header>
    ),
    [status, errorMessage],
  );

  return (
    <div>
      {header}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[12.5px] text-white/40">
          {loading ? "Loading…" : `${conversations.length} archived`}
        </div>
        <button
          type="button"
          onClick={() => void loadArchived()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {conversations.length === 0 && !loading ? (
        <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-[13.5px] text-white/45">
          Nothing archived. Chats you hide will show up here.
        </div>
      ) : (
        <SettingGroup title="Archived">
          {conversations.map((c) => (
            <SettingRow
              key={c.id}
              label={c.title || "Untitled chat"}
              description={`Archived ${friendlyTime(c.updatedAt)}${c.preview ? ` · ${c.preview.slice(0, 80)}` : ""}`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void restore(c.id)}
                  disabled={busyId === c.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] text-white/70 hover:text-white/90 hover:border-cyan-400/40 transition-colors active:opacity-80 disabled:opacity-50"
                  title="Bring back to sidebar"
                >
                  <RotateCcw size={12} />
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => void remove(c.id, c.title)}
                  disabled={busyId === c.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] text-white/70 hover:text-red-300 hover:border-red-400/40 transition-colors active:opacity-80 disabled:opacity-50"
                  title="Delete for good"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </SettingRow>
          ))}
        </SettingGroup>
      )}
    </div>
  );
}
