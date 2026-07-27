import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Briefcase, FolderPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ProjectSummary {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  conversationIds?: string[];
  sourceIds?: string[];
  instructions?: string;
}

export default function ProjectsPage() {
  const [, navigate] = useLocation();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: ProjectSummary[] = data.projects || [];
      list.sort((a, b) => {
        const at = a.updatedAt || a.createdAt || "";
        const bt = b.updatedAt || b.createdAt || "";
        return at < bt ? 1 : -1;
      });
      setProjects(list);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setName("");
      setShowForm(false);
      await refresh();
      if (body?.project?.id) navigate(`/projects/${body.project.id}`);
    } catch (err: any) {
      setError(err?.message || "Could not create project");
    } finally {
      setCreating(false);
    }
  }, [name, refresh, navigate]);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            <Briefcase size={14} />
            Operations
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Projects</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            File conversations, sources, and instructions per initiative. Every project keeps its own
            memory so Zed answers in-context whenever you open it.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <Button
          onClick={() => setShowForm((v) => !v)}
          className="w-full rounded-xl zed-gradient"
        >
          <FolderPlus size={14} className="mr-2" />
          {showForm ? "Cancel" : "New project"}
        </Button>

        {showForm && (
          <section className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.03] p-4 space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Project name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q3 relaunch, Zwap treasury, Investor pitch"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void create();
                }}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <Button
              onClick={() => void create()}
              disabled={creating || !name.trim()}
              className="w-full rounded-xl zed-gradient"
            >
              {creating ? "Creating…" : "Create project"}
            </Button>
          </section>
        )}

        <section className="space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your projects</div>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
              No projects yet. Use "New project" above to file your first initiative.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition-all hover:border-cyan-400/40 hover:bg-white/5 active:scale-[0.99]"
                >
                  <div className="text-sm font-semibold text-foreground">{p.name || "Untitled"}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.conversationIds && p.conversationIds.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.14em]"
                      >
                        {p.conversationIds.length} chat{p.conversationIds.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                    {p.sourceIds && p.sourceIds.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.14em]"
                      >
                        {p.sourceIds.length} source{p.sourceIds.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                  {p.instructions && (
                    <p className="mt-2 text-[11.5px] leading-5 text-muted-foreground">
                      {p.instructions.slice(0, 140)}
                      {p.instructions.length > 140 ? "…" : ""}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
    </main>
  );
}
