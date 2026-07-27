import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, Plus, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RelatedObjects } from "@/components/knowledge/RelatedObjects";

import { AddSourceCard } from "./project-detail/AddSourceCard";
import { SourceCard } from "./project-detail/SourceCard";
import type { ProjectDetail } from "./project-detail/types";

export default function ProjectDetailPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id?: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [addOpen, setAddOpen] = useState(false);

  async function fetchProject() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ProjectDetail;
      setProject(data);
      setInstructions(data.instructions || "");
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveInstructions() {
    if (!id) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/projects/${id}/instructions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ instructions }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProject(data.project);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (e: any) {
      setSaveStatus("error");
      setError(e?.message || "Failed to save");
    }
  }

  async function removeSource(sourceId: string) {
    if (!id || !window.confirm("Remove this source?")) return;
    try {
      const res = await fetch(`/api/projects/${id}/sources/${sourceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchProject();
    } catch (e: any) {
      setError(e?.message || "Failed to remove");
    }
  }

  const sources = project?.sources || [];
  const dirty = instructions !== (project?.instructions || "");

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 zed-glass px-4 pb-3 pt-safe-sm flex items-center justify-between sticky top-0 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/nexus")}
          className="text-muted-foreground hover:text-foreground zed-button rounded-xl"
        >
          <ChevronLeft size={16} className="mr-1" />
          Nexus
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          {project && (
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
          )}
          <span className="font-medium truncate max-w-[55vw]">{project?.name || "Project"}</span>
        </div>
        <span className="w-10" />
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-4 pb-24">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {loading && !project ? (
          <div className="text-center text-muted-foreground py-10 text-sm">Loading…</div>
        ) : !project ? (
          <div className="text-center text-muted-foreground py-10 text-sm">
            Project not found.
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Instructions
                </h2>
                {dirty && (
                  <Button
                    size="sm"
                    onClick={saveInstructions}
                    disabled={saveStatus === "saving"}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-8"
                  >
                    <Save size={12} className="mr-1" />
                    {saveStatus === "saving"
                      ? "Saving…"
                      : saveStatus === "saved"
                        ? "Saved"
                        : "Save"}
                  </Button>
                )}
              </div>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Per-project system prompt. Anything you type here will be injected into the agent context for every conversation filed under this project. E.g. brand voice, target customer, terminology, things to avoid."
                rows={6}
                className="zed-glass border-white/10 text-sm leading-6"
              />
              <p className="text-[11px] text-muted-foreground">
                {instructions.length} / 8000 characters
              </p>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Sources ({sources.length})
                </h2>
                <Button
                  size="sm"
                  onClick={() => setAddOpen((v) => !v)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-8"
                >
                  <Plus size={12} className="mr-1" />
                  {addOpen ? "Cancel" : "Add"}
                </Button>
              </div>

              {addOpen && (
                <AddSourceCard
                  projectId={id!}
                  onAdded={fetchProject}
                  onError={setError}
                  onCancel={() => setAddOpen(false)}
                />
              )}

              {sources.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-6 text-center text-xs text-muted-foreground">
                  No sources yet
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sources.map((source) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      onRemove={() => removeSource(source.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <RelatedObjects
              canonicalName={project.name}
              type="project"
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            />

            <section className="pt-2">
              <Badge
                variant="secondary"
                className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.16em]"
              >
                {project.conversationIds.length} conversation
                {project.conversationIds.length === 1 ? "" : "s"} filed here
              </Badge>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
