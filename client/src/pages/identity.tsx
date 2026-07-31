import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { useAuth } from "@/components/auth/UseAuth";
import MyMemorySettings from "@/components/settings/MyMemorySettings";

interface NoteSummary {
  slug: string;
  title: string;
  preview: string;
  updatedAt: string;
}

interface NoteDetail {
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
}

/**
 * The real Identity surface, reachable from Nexus's "Identity" domain.
 *
 * There's no backend concept literally called a "Personal Constitution" -
 * what's real is the per-user personalization notes corpus
 * (/api/me/personalization/notes), which ZAR's core actually retrieves as
 * context at query time. This page is that: notes you write about yourself,
 * not a fabricated constitution feature.
 */
export default function IdentityPage() {
  const { user } = useAuth() as {
    user?: { username?: string; displayName?: string; email?: string; isAdmin?: boolean };
  };
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/me/personalization/notes", { credentials: "include" });
      if (res.ok) setNotes((await res.json()).notes || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  async function toggleExpand(slug: string) {
    if (expandedSlug === slug) {
      setExpandedSlug(null);
      return;
    }
    setExpandedSlug(slug);
    if (!expandedContent[slug]) {
      const res = await fetch(`/api/me/personalization/notes/${slug}`, { credentials: "include" });
      if (res.ok) {
        const note: NoteDetail = await res.json();
        setExpandedContent((prev) => ({ ...prev, [slug]: note.content }));
      }
    }
  }

  function openNewNote() {
    setEditingSlug(null);
    setTitle("");
    setContent("");
    setError(null);
    setShowForm(true);
  }

  function openEditNote(note: NoteSummary, fullContent: string) {
    setEditingSlug(note.slug);
    setTitle(note.title);
    setContent(fullContent);
    setError(null);
    setShowForm(true);
  }

  async function saveNote() {
    if (!title.trim() || !content.trim()) {
      setError("A title and some content are both needed.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/personalization/notes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          ...(editingSlug ? { slug: editingSlug } : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowForm(false);
      await loadNotes();
    } catch {
      setError("Couldn't save that note. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(slug: string) {
    setNotes((prev) => prev.filter((n) => n.slug !== slug));
    if (expandedSlug === slug) setExpandedSlug(null);
    try {
      await fetch(`/api/me/personalization/notes/${slug}`, { method: "DELETE", credentials: "include" });
    } catch {
      /* optimistic */
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13.5px] text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40";

  return (
    <div className="mx-auto max-w-2xl">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">Signed in as</div>
          <div className="mt-2 text-[15px] font-medium text-white">
            {user?.displayName || user?.username || "Current user"}
          </div>
          {user?.email && <div className="text-[13px] text-white/50">{user.email}</div>}
        </section>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <MyMemorySettings />
        </section>

        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">Personal notes</h2>
            <p className="mt-1 text-[13px] leading-snug text-white/50">
              What you tell ZAR about yourself - background, working style, ongoing context.
              ZAR retrieves these as context when they're relevant to what you're asking.
            </p>
          </div>
        </header>

        {!showForm && (
          <button
            type="button"
            onClick={openNewNote}
            className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-white/80 transition-colors hover:bg-white/[0.06]"
          >
            <Plus size={15} /> New note
          </button>
        )}

        {showForm && (
          <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className={inputClass}
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="What should ZAR know?"
              className={`${inputClass} resize-y leading-relaxed`}
            />
            {error && <p className="text-[12px] text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveNote()}
                disabled={saving}
                className="rounded-lg bg-cyan-400 px-3.5 py-1.5 text-[12.5px] font-medium text-black transition-colors hover:bg-cyan-300 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-[13px] text-white/40">Loading...</p>
        ) : notes.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center text-[13px] text-white/40">
            No notes yet. Add one so ZAR remembers it.
          </p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => {
              const isOpen = expandedSlug === note.slug;
              return (
                <div key={note.slug} className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleExpand(note.slug)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-[14px] font-medium text-white">{note.title}</div>
                      {!isOpen && (
                        <div className="truncate text-[12px] text-white/45">{note.preview}</div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleExpand(note.slug)}
                      className="text-white/40 hover:text-white/70"
                      aria-label={isOpen ? "Collapse" : "Expand"}
                    >
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteNote(note.slug)}
                      className="text-white/40 hover:text-red-300"
                      aria-label="Delete note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="mt-2 space-y-2 border-t border-white/[0.06] pt-2">
                      <p className="whitespace-pre-line text-[13px] leading-relaxed text-white/70">
                        {expandedContent[note.slug] ?? "Loading..."}
                      </p>
                      <button
                        type="button"
                        onClick={() => openEditNote(note, expandedContent[note.slug] ?? "")}
                        className="text-[12px] font-medium text-cyan-300 hover:text-cyan-200"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}
