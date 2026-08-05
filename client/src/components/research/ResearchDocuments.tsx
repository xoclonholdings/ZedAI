import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, FileText, FolderKanban, GraduationCap, HardDrive, Loader2, Lock, RotateCcw, Trash2, Upload } from "lucide-react";
import { uploadRequest } from "@/lib/uploadRequest";

/**
 * Create / Document, then File it.
 *
 * ZAR writes the research up as a plain document you can read later, then
 * you file it where it belongs: into Education, into a Project as a source,
 * or kept in ZAR's Files. Cloud drives (iCloud / Google Drive) show up as
 * options once you connect one.
 */

interface ProjectLite {
  id: string;
  name: string;
}
interface FiledDoc {
  id: string;
  createdAt: string;
  title: string;
  content: string;
}

const DOC_TYPES = ["Report", "Memo", "Letter", "Summary", "Proposal", "Resume", "Contract", "Notes"];

export default function ResearchDocuments({
  seedInstruction = "",
  seedSources = "",
}: {
  seedInstruction?: string;
  seedSources?: string;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [title, setTitle] = useState("");
  const [sources, setSources] = useState("");
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null);
  const [draftFailed, setDraftFailed] = useState<string | null>(null);

  const [dest, setDest] = useState("files");
  const [filing, setFiling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [docs, setDocs] = useState<FiledDoc[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || data || []);
      }
    } catch {
      /* silent */
    }
  }, []);
  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/research/documents", { credentials: "include" });
      if (res.ok) setDocs((await res.json()).documents || []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    void loadDocs();
  }, [loadProjects, loadDocs]);

  const openForm = useCallback(() => {
    setInstruction(seedInstruction);
    setSources(seedSources);
    setTitle("");
    setDocType(DOC_TYPES[0]);
    setDraft(null);
    setDraftFailed(null);
    setNotice(null);
    setError(null);
    setOpen(true);
  }, [seedInstruction, seedSources]);

  const writeUp = useCallback(async () => {
    setError(null);
    setDraftFailed(null);
    if (!instruction.trim() && !sources.trim()) {
      setError("Tell ZAR what to write up (or paste something to base it on).");
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch("/api/research/document", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, title: title.trim() || undefined, sources, docType }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.ok === false) {
        setDraftFailed(body.content || "I couldn't write that up. Try again?");
        setDraft(null);
      } else {
        setDraft({ title: body.title || "Untitled document", content: body.content || "" });
      }
    } catch {
      setDraftFailed("I couldn't reach my brain just now. Give it a moment and try again.");
    } finally {
      setDrafting(false);
    }
  }, [instruction, title, sources, docType]);

  const uploadDocument = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const body = await uploadRequest<any>("/api/research/documents/upload", formData);
      setNotice(
        body.documents?.length === 1
          ? `Filed "${body.documents[0].title}" to ZAR's Files.`
          : `Filed ${body.documents?.length ?? 0} documents to ZAR's Files.`,
      );
      await loadDocs();
    } catch (err: any) {
      setError(err?.message || "Couldn't file that document. Try again.");
    } finally {
      setUploading(false);
    }
  }, [loadDocs]);

  const file = useCallback(async () => {
    if (!draft) return;
    setFiling(true);
    setError(null);
    setNotice(null);
    try {
      let res: Response;
      if (dest === "education") {
        res = await fetch("/api/me/memory/upload", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace: "education", title: draft.title, content: draft.content }),
        });
      } else if (dest.startsWith("project:")) {
        const pid = dest.slice("project:".length);
        res = await fetch(`/api/projects/${pid}/sources`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: draft.title, text: draft.content, notes: "Filed from Research" }),
        });
      } else {
        res = await fetch("/api/research/documents", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: draft.title, content: draft.content }),
        });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const where =
        dest === "education"
          ? "Education"
          : dest.startsWith("project:")
            ? projects.find((p) => `project:${p.id}` === dest)?.name || "the project"
            : "ZAR's Files";
      setNotice(`Filed to ${where}.`);
      setDraft(null);
      setOpen(false);
      if (dest === "files") await loadDocs();
    } catch {
      setError("Couldn't file that. Try again.");
    } finally {
      setFiling(false);
    }
  }, [draft, dest, projects, loadDocs]);

  const removeDoc = useCallback(async (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      await fetch(`/api/research/documents/${id}`, { method: "DELETE", credentials: "include" });
    } catch {
      /* optimistic */
    }
  }, []);

  const input =
    "w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-cyan-400/50";

  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-cyan-300" />
          <span className="text-sm font-semibold text-white">Write it up</span>
          {docs.length > 0 && <span className="text-[11px] text-white/40">{docs.length} filed</span>}
        </div>
        {!open && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/80 hover:text-white transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? "Filing…" : "Upload a document"}
            </button>
            <button
              type="button"
              onClick={openForm}
              className="rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 transition-colors"
            >
              Create a document
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.csv"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                if (files.length > 0) void uploadDocument(files);
              }}
              className="hidden"
              aria-label="Choose a document to file"
            />
          </div>
        )}
      </div>

      {notice && (
        <div className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-[12px] text-emerald-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-2 rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-[12px] text-red-200">
          {error}
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          {!draft ? (
            <>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[11.5px] text-white/40">Type:</span>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className={`${input} w-auto`}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-neutral-900">
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional — ZAR will pick one)"
                className={input}
              />
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={2}
                placeholder="What should this document cover?"
                className={`${input} resize-y`}
              />
              <textarea
                value={sources}
                onChange={(e) => setSources(e.target.value)}
                rows={3}
                placeholder="Anything to base it on (optional) — paste notes, results, a summary."
                className={`${input} resize-y`}
              />
              {draftFailed && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.05] px-3 py-2 text-[12.5px] text-white/85">
                  {draftFailed}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void writeUp()}
                  disabled={drafting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 disabled:opacity-50"
                >
                  {draftFailed && <RotateCcw size={12} />}
                  {drafting ? "Writing…" : draftFailed ? "Try again" : "Write it up"}
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className={`${input} font-semibold`}
              />
              <textarea
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                rows={10}
                className={`${input} resize-y leading-relaxed`}
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-[11.5px] text-white/40">File it to:</span>
                <select value={dest} onChange={(e) => setDest(e.target.value)} className={`${input} w-auto`}>
                  <option value="files" className="bg-neutral-900">ZAR's Files</option>
                  <option value="education" className="bg-neutral-900">Education</option>
                  {projects.map((p) => (
                    <option key={p.id} value={`project:${p.id}`} className="bg-neutral-900">
                      Project · {p.name}
                    </option>
                  ))}
                  <option value="icloud" disabled className="bg-neutral-900">
                    iCloud Drive (connect first)
                  </option>
                  <option value="gdrive" disabled className="bg-neutral-900">
                    Google Drive (connect first)
                  </option>
                </select>
                <button
                  type="button"
                  onClick={() => void file()}
                  disabled={filing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 disabled:opacity-50"
                >
                  {dest === "education" ? (
                    <GraduationCap size={13} />
                  ) : dest.startsWith("project") ? (
                    <FolderKanban size={13} />
                  ) : dest === "files" ? (
                    <HardDrive size={13} />
                  ) : (
                    <Lock size={13} />
                  )}
                  {filing ? "Filing…" : "File it"}
                </button>
              </div>
              <p className="text-right text-[10.5px] text-white/30">
                iCloud / Google Drive show up here once you connect one.
              </p>
            </>
          )}
        </div>
      )}

      {/* ZAR's Files */}
      {docs.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/40">ZAR's Files</div>
          {docs.map((d) => {
            const isOpen = expanded === d.id;
            return (
              <div key={d.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : d.id)}
                    className="min-w-0 flex-1 text-left text-[13px] font-medium text-white truncate"
                  >
                    {d.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : d.id)}
                    className="text-white/40 hover:text-white/70"
                  >
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeDoc(d.id)}
                    className="text-white/40 hover:text-red-300"
                    aria-label="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {isOpen && (
                  <div className="mt-1.5 whitespace-pre-line text-[12.5px] text-white/70 leading-relaxed">
                    {d.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
