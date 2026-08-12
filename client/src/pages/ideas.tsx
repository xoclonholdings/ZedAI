import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Send, Trash2 } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";

interface IdeaRecord {
  id: string;
  content: string;
  createdAt?: string | Date | null;
}

interface IdeasResponse {
  items: IdeaRecord[];
}

const QUERY_KEY = ["/api/knowledge/scratchpad"];
const IDEA_LIMIT = 280;

/** Lightweight, persistent capture for short Ideas - never a Chat alias. */
export default function IdeasPage() {
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<IdeasResponse>({ queryKey: QUERY_KEY });

  const createIdea = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/knowledge/scratchpad", {
        content: draft.trim(),
        tags: ["idea"],
      });
      return response.json();
    },
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteIdea = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/knowledge/scratchpad/${id}`),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const ideas = (data?.items ?? []).filter((item: any) => (
    Array.isArray(item.tags) && item.tags.includes("idea")
  ));

  return (
    <main className="mx-auto flex h-full max-w-2xl flex-col gap-4 p-4">
      <section className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, IDEA_LIMIT))}
          rows={3}
          maxLength={IDEA_LIMIT}
          placeholder="Drop an idea..."
          className="w-full resize-none bg-transparent text-sm leading-6 text-white placeholder:text-white/30 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-white/35">{draft.length}/{IDEA_LIMIT}</span>
          <button
            type="button"
            onClick={() => createIdea.mutate()}
            disabled={!draft.trim() || createIdea.isPending}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-black transition hover:bg-cyan-200 disabled:opacity-35"
            aria-label="Save idea"
          >
            <Send size={14} />
          </button>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-white/40">Loading ideas...</p>
        ) : ideas.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
            <Lightbulb size={20} className="mb-2 text-white/30" />
            <p className="text-sm text-white/45">Your quick ideas will collect here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ideas.map((idea) => (
              <article key={idea.id} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13.5px] leading-5 text-white/85">
                    {idea.content}
                  </p>
                  <button
                    type="button"
                    onClick={() => deleteIdea.mutate(idea.id)}
                    className="shrink-0 rounded-full p-1.5 text-white/30 hover:bg-white/5 hover:text-red-200"
                    aria-label="Delete idea"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {idea.createdAt ? (
                  <time className="mt-2 block text-[10.5px] text-white/30">
                    {new Date(idea.createdAt).toLocaleString()}
                  </time>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
