import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  ChevronLeft,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ProjectSource {
  id: string;
  label: string;
  url?: string;
  text?: string;
  notes?: string;
  addedAt: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  color: string;
  conversationIds: string[];
  instructions?: string;
  sources?: ProjectSource[];
}

export default function ProjectDetailPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id?: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"file" | "url" | "text">("file");
  const [pendingLabel, setPendingLabel] = useState("");
  const [pendingUrl, setPendingUrl] = useState("");
  const [pendingText, setPendingText] = useState("");
  const [pendingNotes, setPendingNotes] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function addSource() {
    if (!id) return;
    setAddingSource(true);
    try {
      let res: Response;
      if (addMode === "file") {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          throw new Error("Pick a file first");
        }
        const fd = new FormData();
        fd.append("file", file);
        if (pendingLabel) fd.append("label", pendingLabel);
        if (pendingNotes) fd.append("notes", pendingNotes);
        res = await fetch(`/api/projects/${id}/sources`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });
      } else {
        const payload: any = {
          label: pendingLabel || (addMode === "url" ? pendingUrl : "Snippet"),
          notes: pendingNotes || undefined,
        };
        if (addMode === "url") payload.url = pendingUrl;
        if (addMode === "text") payload.text = pendingText;
        res = await fetch(`/api/projects/${id}/sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${body ? ` — ${body.slice(0, 160)}` : ""}`);
      }
      setAddOpen(false);
      setPendingLabel("");
      setPendingUrl("");
      setPendingText("");
      setPendingNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchProject();
    } catch (e: any) {
      setError(e?.message || "Failed to add source");
    } finally {
      setAddingSource(false);
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
          onClick={() => navigate("/chat")}
          className="text-muted-foreground hover:text-foreground zed-button rounded-xl"
        >
          <ChevronLeft size={16} className="mr-1" />
          Chat
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          {project && (
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
          )}
          <span className="font-medium truncate max-w-[55vw]">
            {project?.name || "Project"}
          </span>
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
            {/* Instructions */}
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

            {/* Sources */}
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
                <Card className="zed-glass border-white/10">
                  <CardContent className="p-3 space-y-2.5">
                    <div className="flex gap-1.5">
                      {(["file", "url", "text"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setAddMode(m)}
                          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                            addMode === m
                              ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                              : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {m === "file" ? "File" : m === "url" ? "URL" : "Text"}
                        </button>
                      ))}
                    </div>
                    <Input
                      value={pendingLabel}
                      onChange={(e) => setPendingLabel(e.target.value)}
                      className="zed-glass border-white/10 h-9 text-sm"
                      placeholder="Label (e.g. Brand voice doc)"
                    />
                    {addMode === "file" && (
                      <Input
                        ref={fileInputRef}
                        type="file"
                        className="zed-glass border-white/10 text-xs"
                      />
                    )}
                    {addMode === "url" && (
                      <Input
                        value={pendingUrl}
                        onChange={(e) => setPendingUrl(e.target.value)}
                        className="zed-glass border-white/10 h-9 text-sm font-mono"
                        placeholder="https://…"
                      />
                    )}
                    {addMode === "text" && (
                      <Textarea
                        value={pendingText}
                        onChange={(e) => setPendingText(e.target.value)}
                        rows={5}
                        className="zed-glass border-white/10 text-sm"
                        placeholder="Paste a snippet the agents should know about…"
                      />
                    )}
                    <Input
                      value={pendingNotes}
                      onChange={(e) => setPendingNotes(e.target.value)}
                      className="zed-glass border-white/10 h-9 text-sm"
                      placeholder="Notes (optional)"
                    />
                    <Button
                      onClick={addSource}
                      disabled={addingSource}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      {addingSource ? (
                        <Loader2 size={14} className="mr-2 animate-spin" />
                      ) : addMode === "file" ? (
                        <Upload size={14} className="mr-2" />
                      ) : (
                        <Plus size={14} className="mr-2" />
                      )}
                      Add source
                    </Button>
                  </CardContent>
                </Card>
              )}

              {sources.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-6 text-center text-xs text-muted-foreground">
                  No sources yet
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sources.map((source) => (
                    <Card key={source.id} className="zed-glass border-white/10">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0">
                            {source.url ? (
                              <LinkIcon size={13} className="text-cyan-300" />
                            ) : (
                              <FileText size={13} className="text-purple-300" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {source.label}
                              </span>
                              {source.url && (
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-300 hover:text-cyan-200"
                                >
                                  <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                            {source.url && (
                              <p className="text-[11px] font-mono text-muted-foreground truncate">
                                {source.url}
                              </p>
                            )}
                            {source.text && (
                              <p className="text-[11px] text-muted-foreground/90 line-clamp-2 leading-5 mt-0.5">
                                {source.text}
                              </p>
                            )}
                            {source.notes && (
                              <p className="text-[11px] italic text-muted-foreground/80 mt-0.5">
                                {source.notes}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSource(source.id)}
                            className="text-muted-foreground hover:text-red-300 shrink-0"
                            aria-label="Remove source"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

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
