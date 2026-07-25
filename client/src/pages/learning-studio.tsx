import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  GraduationCap,
  MessageSquare,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

import AssistantMarkdown from "@/components/chat/AssistantMarkdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  AssessmentAttempt,
  LearningAssessment,
  LearningBlueprint,
  LearningBlueprintUnit,
  LearningLesson,
  LearningPath,
  LearningPathDetail,
} from "@shared/learning-types";

type ProjectSummary = {
  id: string;
  name: string;
};

type Mode = "learn" | "recall" | "check" | "practice" | "apply" | "review";

const EMPTY_FORM = {
  topic: "",
  assumedLevel: "Beginner with some Zed context",
  workspaceId: "education",
  projectId: "",
  notes: "",
};

const WORKSPACES = [
  { id: "education", label: "Education" },
  { id: "research", label: "Research" },
  { id: "operations", label: "Operations" },
  { id: "finance", label: "Finance" },
  { id: "marketing", label: "Marketing" },
];

function statusTone(status?: string): string {
  if (status === "active") return "border-emerald-400/25 text-emerald-200";
  if (status === "blueprint") return "border-amber-400/25 text-amber-200";
  return "border-white/10 text-white/65";
}

function latestAttempt(attempts: AssessmentAttempt[], lessonId?: string): AssessmentAttempt | null {
  return attempts.find((attempt) => attempt.lessonId === lessonId) || null;
}

export default function LearningStudioPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id?: string }>();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [detail, setDetail] = useState<LearningPathDetail | null>(null);
  const [editableBlueprint, setEditableBlueprint] = useState<LearningBlueprint | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [revising, setRevising] = useState(false);
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [showCreate, setShowCreate] = useState(!id);
  const [mode, setMode] = useState<Mode>("learn");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lesson = useMemo<LearningLesson | null>(() => {
    if (!detail) return null;
    return (
      detail.lessons.find((item) => item.id === detail.path.activeLessonId) ||
      detail.lessons[0] ||
      null
    );
  }, [detail]);

  const assessment = useMemo<LearningAssessment | null>(() => {
    if (!detail || !lesson) return null;
    return detail.assessments.find((item) => item.lessonId === lesson.id) || null;
  }, [detail, lesson]);

  const lastAttempt = useMemo(
    () => latestAttempt(detail?.attempts || [], lesson?.id),
    [detail?.attempts, lesson?.id],
  );

  const refreshPaths = useCallback(async () => {
    const res = await fetch("/api/learning/paths", { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setPaths(data.paths || []);
  }, []);

  const refreshDetail = useCallback(async (pathId: string) => {
    const res = await fetch(`/api/learning/paths/${pathId}`, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as LearningPathDetail;
    setDetail(data);
    setEditableBlueprint(data.blueprint || null);
    setAnswers({});
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsRes] = await Promise.all([
        fetch("/api/projects", { credentials: "include" }).catch(() => null),
        refreshPaths(),
      ]);
      if (projectsRes?.ok) {
        const body = await projectsRes.json();
        setProjects(body.projects || []);
      }
      if (id) await refreshDetail(id);
    } catch (err: any) {
      setError(err?.message || "Failed to load Learning Studio.");
    } finally {
      setLoading(false);
    }
  }, [id, refreshDetail, refreshPaths]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createBlueprint() {
    if (!form.topic.trim()) {
      setError("Topic is required.");
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append("topic", form.topic.trim());
      fd.append("assumedLevel", form.assumedLevel);
      fd.append("workspaceId", form.workspaceId);
      if (form.projectId) fd.append("projectId", form.projectId);
      if (form.notes.trim()) fd.append("notes", form.notes.trim());
      for (const file of files) fd.append("files", file);

      const res = await fetch("/api/learning/paths/blueprint", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const next = body as LearningPathDetail;
      setDetail(next);
      setEditableBlueprint(next.blueprint || null);
      setForm(EMPTY_FORM);
      setFiles([]);
      setShowCreate(false);
      await refreshPaths();
      navigate(`/learning/paths/${next.path.id}`);
    } catch (err: any) {
      setError(err?.message || "Could not create blueprint.");
    } finally {
      setCreating(false);
    }
  }

  async function approveBlueprint() {
    if (!detail?.path || !editableBlueprint) return;
    setApproving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/learning/paths/${detail.path.id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint: editableBlueprint }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setDetail(body as LearningPathDetail);
      setEditableBlueprint((body as LearningPathDetail).blueprint || null);
      setMode("learn");
      setNotice("Blueprint approved. First lesson generated.");
      await refreshPaths();
    } catch (err: any) {
      setError(err?.message || "Could not approve blueprint.");
    } finally {
      setApproving(false);
    }
  }

  async function reviseBlueprint() {
    if (!detail?.path || !revisionInstruction.trim()) return;
    setRevising(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/learning/paths/${detail.path.id}/revise`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: revisionInstruction.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const next = body as LearningPathDetail;
      setDetail(next);
      setEditableBlueprint(next.blueprint || null);
      setRevisionInstruction("");
      const latest = next.blueprint?.revisions?.[next.blueprint.revisions.length - 1];
      setNotice(latest ? `Revised: ${latest.summary}` : "Blueprint revised.");
    } catch (err: any) {
      setError(err?.message || "Could not revise blueprint.");
    } finally {
      setRevising(false);
    }
  }

  async function advanceLesson() {
    if (!detail?.path) return;
    setAdvancing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/learning/paths/${detail.path.id}/advance`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const next = body as LearningPathDetail;
      setDetail(next);
      setMode("learn");
      setAnswers({});
      setNotice(
        next.path.status === "completed" ? "Course complete." : "Advanced to the next lesson.",
      );
      await refreshPaths();
    } catch (err: any) {
      setError(err?.message || "Could not advance to the next lesson.");
    } finally {
      setAdvancing(false);
    }
  }

  async function submitQuiz() {
    if (!detail?.path || !lesson || !assessment) return;
    setSubmittingQuiz(true);
    setError(null);
    setNotice(null);
    try {
      const ordered = assessment.questions.map((question) => answers[question.id] ?? -1);
      const res = await fetch(
        `/api/learning/paths/${detail.path.id}/lessons/${lesson.id}/attempts`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: ordered }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setDetail(body.detail as LearningPathDetail);
      setNotice(body.attempt?.feedback || "Quiz submitted.");
      await refreshPaths();
    } catch (err: any) {
      setError(err?.message || "Could not submit quiz.");
    } finally {
      setSubmittingQuiz(false);
    }
  }

  function updateBlueprint(patch: Partial<LearningBlueprint>) {
    if (!editableBlueprint) return;
    setEditableBlueprint({ ...editableBlueprint, ...patch });
  }

  function updateUnit(unitId: string, patch: Partial<LearningBlueprintUnit>) {
    if (!editableBlueprint) return;
    setEditableBlueprint({
      ...editableBlueprint,
      units: editableBlueprint.units.map((unit) =>
        unit.id === unitId ? { ...unit, ...patch } : unit,
      ),
    });
  }

  function updateLesson(unitId: string, lessonId: string, patch: { title?: string; objective?: string }) {
    if (!editableBlueprint) return;
    setEditableBlueprint({
      ...editableBlueprint,
      units: editableBlueprint.units.map((unit) =>
        unit.id === unitId
          ? {
              ...unit,
              lessons: unit.lessons.map((lessonItem) =>
                lessonItem.id === lessonId ? { ...lessonItem, ...patch } : lessonItem,
              ),
            }
          : unit,
      ),
    });
  }

  function openTutor() {
    if (!detail?.path || !lesson) return;
    navigate(
      `/chat?ctx=education&learningPathId=${encodeURIComponent(detail.path.id)}&lessonId=${encodeURIComponent(lesson.id)}`,
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe-sm zed-glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/workspaces/education")}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Education
        </Button>
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-cyan-300" />
          <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            Learning Studio
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
          aria-label="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <main className="mx-auto grid max-w-6xl gap-4 p-4 pb-24 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <Button
            onClick={() => setShowCreate((value) => !value)}
            className="w-full rounded-xl zed-gradient"
          >
            <Plus size={14} className="mr-2" />
            {showCreate ? "Close" : "Create Learning Path"}
          </Button>

          {showCreate && (
            <section className="space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.03] p-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Topic</label>
                <input
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  placeholder="ZWAP specification, repo architecture, trading rules"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Assumed level</label>
                <select
                  value={form.assumedLevel}
                  onChange={(e) => setForm({ ...form, assumedLevel: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none"
                >
                  <option className="bg-neutral-900">Beginner with some Zed context</option>
                  <option className="bg-neutral-900">Intermediate</option>
                  <option className="bg-neutral-900">Advanced</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Workspace</label>
                  <select
                    value={form.workspaceId}
                    onChange={(e) => setForm({ ...form, workspaceId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none"
                  >
                    {WORKSPACES.map((workspace) => (
                      <option key={workspace.id} value={workspace.id} className="bg-neutral-900">
                        {workspace.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Project</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none"
                  >
                    <option value="" className="bg-neutral-900">None</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id} className="bg-neutral-900">
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Notes</label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={5}
                  placeholder="Paste source notes, links, transcript sections, or constraints."
                  className="mt-1 border-white/10 bg-black/40 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Files</label>
                <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/70 hover:border-white/25">
                  <Upload size={14} />
                  Attach files
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                </label>
                {files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {files.map((file) => (
                      <div key={file.name} className="flex items-center justify-between gap-2 text-[11px] text-white/55">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setFiles(files.filter((item) => item !== file))}
                          className="text-white/45 hover:text-white"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={() => void createBlueprint()}
                disabled={creating}
                className="w-full rounded-xl zed-gradient"
              >
                {creating ? "Generating..." : "Generate Blueprint"}
              </Button>
            </section>
          )}

          <section className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Learning paths</div>
            {paths.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-muted-foreground">
                No learning paths yet.
              </div>
            ) : (
              <div className="space-y-2">
                {paths.map((path) => (
                  <button
                    key={path.id}
                    type="button"
                    onClick={() => navigate(`/learning/paths/${path.id}`)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors hover:border-cyan-400/35 ${
                      detail?.path.id === path.id ? "border-cyan-400/35 bg-cyan-400/[0.06]" : "border-white/10 bg-black/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{path.title}</span>
                      <Badge variant="secondary" className={`zed-glass text-[9px] uppercase tracking-[0.14em] ${statusTone(path.status)}`}>
                        {path.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[11.5px] leading-5 text-white/50">
                      {path.objective.slice(0, 120)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="min-w-0 space-y-4">
          {notice && (
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] px-3 py-2 text-sm text-emerald-200">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {!detail ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-sm text-muted-foreground">
              Select an existing path or create a new blueprint.
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-200/80">
                      <GraduationCap size={14} />
                      Learning Path
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold">{detail.path.title}</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {detail.path.objective}
                    </p>
                  </div>
                  <Badge variant="secondary" className={`zed-glass text-[10px] uppercase tracking-[0.14em] ${statusTone(detail.path.status)}`}>
                    {detail.path.status}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
                    {detail.sources.length} source{detail.sources.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
                    {detail.mastery.length} mastery record{detail.mastery.length === 1 ? "" : "s"}
                  </Badge>
                  {lastAttempt && (
                    <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.12em]">
                      last quiz {lastAttempt.score}%
                    </Badge>
                  )}
                </div>
              </section>

              {detail.path.status === "blueprint" && editableBlueprint && (
                <BlueprintEditor
                  blueprint={editableBlueprint}
                  onPatch={updateBlueprint}
                  onUpdateUnit={updateUnit}
                  onUpdateLesson={updateLesson}
                  onApprove={() => void approveBlueprint()}
                  approving={approving}
                  revisionInstruction={revisionInstruction}
                  onRevisionInstructionChange={setRevisionInstruction}
                  onRevise={() => void reviseBlueprint()}
                  revising={revising}
                />
              )}

              {detail.path.status === "completed" && (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] px-4 py-3 text-sm text-emerald-200">
                  Course complete — every lesson has been passed.
                </div>
              )}

              {lesson && detail.path.status !== "blueprint" && (
                <LessonExperience
                  lesson={lesson}
                  assessment={assessment}
                  mode={mode}
                  onMode={setMode}
                  answers={answers}
                  setAnswers={setAnswers}
                  onSubmitQuiz={() => void submitQuiz()}
                  submittingQuiz={submittingQuiz}
                  lastAttempt={lastAttempt}
                  onOpenTutor={openTutor}
                  canAdvance={detail.path.status === "active" && Boolean(lastAttempt?.passed)}
                  onAdvance={() => void advanceLesson()}
                  advancing={advancing}
                />
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function BlueprintEditor({
  blueprint,
  onPatch,
  onUpdateUnit,
  onUpdateLesson,
  onApprove,
  approving,
  revisionInstruction,
  onRevisionInstructionChange,
  onRevise,
  revising,
}: {
  blueprint: LearningBlueprint;
  onPatch: (patch: Partial<LearningBlueprint>) => void;
  onUpdateUnit: (unitId: string, patch: Partial<LearningBlueprintUnit>) => void;
  onUpdateLesson: (unitId: string, lessonId: string, patch: { title?: string; objective?: string }) => void;
  onApprove: () => void;
  approving: boolean;
  revisionInstruction: string;
  onRevisionInstructionChange: (value: string) => void;
  onRevise: () => void;
  revising: boolean;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-200/80">
            <ClipboardCheck size={14} />
            Blueprint
          </div>
          <h2 className="mt-1 text-lg font-semibold">Approve the structure first</h2>
        </div>
        <Button onClick={onApprove} disabled={approving} className="rounded-xl zed-gradient">
          <CheckCircle2 size={14} className="mr-2" />
          {approving ? "Approving..." : "Approve Blueprint"}
        </Button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
        <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">
          Ask Zed to change the blueprint
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={revisionInstruction}
            onChange={(e) => onRevisionInstructionChange(e.target.value)}
            placeholder='e.g. "Add a unit about risk controls" or "Make this less beginner-oriented"'
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !revising && revisionInstruction.trim()) onRevise();
            }}
          />
          <Button
            onClick={onRevise}
            disabled={revising || !revisionInstruction.trim()}
            variant="secondary"
            className="rounded-xl zed-glass shrink-0"
          >
            {revising ? "Revising..." : "Revise"}
          </Button>
        </div>
        {blueprint.revisions.length > 0 && (
          <div className="mt-3 space-y-1">
            {blueprint.revisions.slice().reverse().map((revision) => (
              <div key={revision.id} className="text-[11.5px] leading-5 text-white/50">
                <span className="text-white/70">"{revision.instruction}"</span> — {revision.summary}
              </div>
            ))}
          </div>
        )}
      </div>

      {blueprint.gaps.length > 0 && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-amber-200/70">
            Gaps Zed found in the source material
          </div>
          <ul className="mt-2 space-y-1 text-[12.5px] leading-5 text-white/65">
            {blueprint.gaps.map((gap, index) => (
              <li key={index}>- {gap}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Objective</label>
          <Textarea
            value={blueprint.objective}
            onChange={(e) => onPatch({ objective: e.target.value })}
            rows={3}
            className="mt-1 border-white/10 bg-black/40 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-[0.16em] text-white/60">Depth</label>
          <Textarea
            value={blueprint.estimatedDepth}
            onChange={(e) => onPatch({ estimatedDepth: e.target.value })}
            rows={3}
            className="mt-1 border-white/10 bg-black/40 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        {blueprint.units.map((unit) => (
          <div key={unit.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
            <input
              value={unit.title}
              onChange={(e) => onUpdateUnit(unit.id, { title: e.target.value })}
              className="w-full bg-transparent text-sm font-semibold text-white outline-none"
            />
            <Textarea
              value={unit.objective}
              onChange={(e) => onUpdateUnit(unit.id, { objective: e.target.value })}
              rows={2}
              className="mt-2 border-white/10 bg-black/30 text-xs leading-5"
            />
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {unit.lessons.map((lesson) => (
                <div key={lesson.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <input
                    value={lesson.title}
                    onChange={(e) => onUpdateLesson(unit.id, lesson.id, { title: e.target.value })}
                    className="w-full bg-transparent text-[13px] font-medium text-white outline-none"
                  />
                  <Textarea
                    value={lesson.objective}
                    onChange={(e) => onUpdateLesson(unit.id, lesson.id, { objective: e.target.value })}
                    rows={2}
                    className="mt-2 border-white/10 bg-black/30 text-xs leading-5"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LessonExperience({
  lesson,
  assessment,
  mode,
  onMode,
  answers,
  setAnswers,
  onSubmitQuiz,
  submittingQuiz,
  lastAttempt,
  onOpenTutor,
  canAdvance,
  onAdvance,
  advancing,
}: {
  lesson: LearningLesson;
  assessment: LearningAssessment | null;
  mode: Mode;
  onMode: (mode: Mode) => void;
  answers: Record<string, number>;
  setAnswers: (answers: Record<string, number>) => void;
  onSubmitQuiz: () => void;
  submittingQuiz: boolean;
  lastAttempt: AssessmentAttempt | null;
  onOpenTutor: () => void;
  canAdvance: boolean;
  onAdvance: () => void;
  advancing: boolean;
}) {
  const modes: Array<{ id: Mode; label: string }> = [
    { id: "learn", label: "Learn" },
    { id: "recall", label: "Recall" },
    { id: "check", label: "Check" },
    { id: "practice", label: "Practice" },
    { id: "apply", label: "Apply" },
    { id: "review", label: "Review" },
  ];

  return (
    <section className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-200/80">
            <BookOpen size={14} />
            Active Lesson
          </div>
          <h2 className="mt-1 text-xl font-semibold">{lesson.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {lesson.summary}
          </p>
        </div>
        <Button onClick={onOpenTutor} className="rounded-xl zed-gradient">
          <MessageSquare size={14} className="mr-2" />
          Discuss
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onMode(item.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === item.id
                ? "border-cyan-400/40 bg-cyan-400/[0.12] text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-[260px]">
        {mode === "learn" && (
          <div className="space-y-4">
            <div className="prose prose-invert max-w-none">
              <AssistantMarkdown content={lesson.content} />
            </div>
            {lesson.citations.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Sources referenced</div>
                <ul className="mt-2 space-y-1 text-[12px] leading-5 text-white/60">
                  {lesson.citations.map((citation, index) => (
                    <li key={index}>
                      <span className="text-white/80">{citation.sourceLabel}</span>
                      {citation.note ? ` — ${citation.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {mode === "recall" && (
          <div className="grid gap-3 md:grid-cols-2">
            {lesson.flashcards.map((card) => (
              <div key={card.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.14em] text-white/45">Front</div>
                <div className="mt-1 text-sm font-medium">{card.front}</div>
                <div className="mt-3 text-xs uppercase tracking-[0.14em] text-white/45">Back</div>
                <div className="mt-1 text-sm leading-6 text-white/70">{card.back}</div>
              </div>
            ))}
          </div>
        )}

        {mode === "check" && assessment && (
          <div className="space-y-4">
            {lastAttempt && (
              <div className={`rounded-xl border px-3 py-2 text-sm ${lastAttempt.passed ? "border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-200" : "border-amber-400/25 bg-amber-400/[0.05] text-amber-200"}`}>
                Last attempt: {lastAttempt.score}% - {lastAttempt.feedback}
              </div>
            )}
            {assessment.questions.map((question, qIndex) => (
              <div key={question.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-sm font-medium">
                  {qIndex + 1}. {question.prompt}
                </div>
                <div className="mt-3 grid gap-2">
                  {question.choices.map((choice, choiceIndex) => (
                    <label
                      key={choice}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/70 hover:border-white/25"
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[question.id] === choiceIndex}
                        onChange={() => setAnswers({ ...answers, [question.id]: choiceIndex })}
                        className="mt-1"
                      />
                      <span>{choice}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button onClick={onSubmitQuiz} disabled={submittingQuiz} className="rounded-xl zed-gradient">
                {submittingQuiz ? "Submitting..." : "Submit Quiz"}
              </Button>
              {canAdvance && (
                <Button onClick={onAdvance} disabled={advancing} variant="secondary" className="rounded-xl zed-glass">
                  {advancing ? "Loading..." : "Continue to Next Lesson"}
                </Button>
              )}
            </div>
          </div>
        )}

        {mode === "practice" && (
          <PromptPanel title="Practice" content={lesson.practicePrompt} />
        )}
        {mode === "apply" && (
          <PromptPanel title="Apply" content={lesson.applyPrompt} />
        )}
        {mode === "review" && (
          <PromptPanel title="Review" content={lesson.reviewSummary} />
        )}
      </div>
    </section>
  );
}

function PromptPanel({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">{title}</div>
      <div className="mt-2 text-sm leading-6 text-white/75">{content}</div>
    </div>
  );
}
