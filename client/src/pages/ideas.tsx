import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";

interface IdeaRecord {
  id: string;
  content: string;
  createdAt?: string | Date | null;
  tags?: string[] | null;
}

interface IdeasResponse {
  items: IdeaRecord[];
}

const QUERY_KEY = ["/api/knowledge/scratchpad"];

/** Display-only console surface for Ideas captured through the persistent dock. */
export default function IdeasPage() {
  const { data, isLoading } = useQuery<IdeasResponse>({ queryKey: QUERY_KEY });

  const ideas = (data?.items ?? []).filter((item) => (
    Array.isArray(item.tags) && item.tags.includes("idea")
  ));

  return (
    <main className="mx-auto flex h-full max-w-2xl flex-col p-4" data-ideas-screen="output-only">
      <section className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-white/40">Loading ideas...</p>
        ) : ideas.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center text-center">
            <Lightbulb size={20} className="mb-2 text-white/30" />
            <p className="text-sm text-white/45">Your quick ideas will collect here.</p>
          </div>
        ) : (
          <div
            className="divide-y divide-white/[0.08] border-y border-white/[0.08]"
            data-list-presentation="rows"
          >
            {ideas.map((idea) => (
              <article key={idea.id} className="py-3">
                <p className="whitespace-pre-wrap text-[13.5px] leading-5 text-white/85">
                  {idea.content}
                </p>
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
