import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, GraduationCap, Upload } from "lucide-react";

import type {
  KnowledgeAreaAssessment,
  KnowledgeAreaInfo,
} from "@shared/trading-training-types";

import {
  EmptyBox,
  NoticeBanner,
  StageShell,
  textareaClass,
} from "./stage-atoms";

/**
 * The Learn stage, organised as sections — one per required knowledge
 * area (market structure, liquidity, risk, …). Each section is where you
 * feed ZAR education for that topic, then test ZAR on that section
 * specifically. Feeding and testing here reuse ZAR's existing
 * TradingKnowledgeBase and assessment engine; nothing new is duplicated.
 *
 * Areas are picked from one dropdown rather than stacked as separate
 * cards, so only the selected area's feed/test panel is on screen.
 */

function scoreClass(score: number, passed: boolean): string {
  if (passed) return "bg-emerald-400/15 text-emerald-300";
  if (score >= 40) return "bg-yellow-400/15 text-yellow-200";
  return "bg-white/10 text-white/50";
}

function verdictClass(verdict: string): string {
  if (verdict === "correct") return "text-emerald-300";
  if (verdict === "partial") return "text-yellow-200";
  if (verdict === "incorrect") return "text-red-300";
  return "text-white/50";
}

export default function KnowledgeSections({ onFed }: { onFed?: () => void }) {
  const [areas, setAreas] = useState<KnowledgeAreaInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trading/knowledge/areas", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Could not load sections (HTTP ${res.status})`);
      }
      const data = await res.json();
      setAreas(data.areas || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load sections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSelectedId((v) => (v && areas.some((a) => a.id === v) ? v : areas[0]?.id ?? null));
  }, [areas]);

  const selectedArea = useMemo(() => areas.find((a) => a.id === selectedId) || null, [areas, selectedId]);

  return (
    <StageShell
      eyebrow="Learn"
      title="Teach ZAR, section by section"
      description="Each section is a required area of ZAR's trading framework. Add educational material to a section, then test ZAR on it specifically. ZAR organizes what you provide and is graded only on what it actually learned."
      onRefresh={() => void refresh()}
      refreshing={loading}
    >
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}

      {areas.length === 0 && (loading || !error) && (
        <EmptyBox>{loading ? "Loading sections…" : "No knowledge sections are configured."}</EmptyBox>
      )}

      {areas.length > 0 && (
        <label className="block">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.08em] text-white/50">Section</div>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-400/50"
          >
            {areas.map((area) => (
              <option key={area.id} value={area.id} className="bg-neutral-900">
                {area.title} {area.covered ? `— ${area.entryCount} added` : "— not started"}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedArea && (
        <SectionDetail key={selectedArea.id} area={selectedArea} onChanged={refresh} onFed={onFed} />
      )}
    </StageShell>
  );
}

function SectionDetail({
  area,
  onChanged,
  onFed,
}: {
  area: KnowledgeAreaInfo;
  onChanged: () => void;
  onFed?: () => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<KnowledgeAreaAssessment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const feed = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (files.length === 0 && !text.trim()) {
      setError("Attach a file or paste some notes for this section.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("source", area.title);
      fd.append("area", area.id);
      if (text.trim()) {
        fd.append("title", area.title);
        fd.append("text", text.trim());
      }
      const res = await fetch("/api/trading/knowledge/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setText("");
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      setNotice(
        `ZAR added ${body?.totals?.sources || 0} source(s) to ${area.title}. Test ZAR when ready.`,
      );
      onFed?.();
      onChanged();
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [files, text, area, onChanged, onFed]);

  const test = useCallback(async () => {
    setError(null);
    setNotice(null);
    setTesting(true);
    try {
      const res = await fetch(`/api/trading/knowledge/areas/${area.id}/assess`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setAssessment(body.assessment as KnowledgeAreaAssessment);
    } catch (err: any) {
      setError(err?.message || "Section test failed");
    } finally {
      setTesting(false);
    }
  }, [area.id]);

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <GraduationCap size={14} className="text-cyan-300 shrink-0" />
            <span className="text-[13.5px] font-semibold text-white">{area.title}</span>
            {area.covered ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 bg-cyan-400/15 text-cyan-200">
                <CheckCircle2 size={11} /> {area.entryCount} added
              </span>
            ) : (
              <span className="text-[10.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 bg-white/10 text-white/40">
                Not started
              </span>
            )}
            {assessment && (
              <span
                className={`text-[10.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${scoreClass(
                  assessment.score,
                  assessment.passed,
                )}`}
              >
                {assessment.passed ? "Passed" : "Not ready"} · {assessment.score}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11.5px] text-white/45 leading-snug">
            {area.requiredTopics.join(" · ")}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void test()}
          disabled={testing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-2.5 py-1 text-[11.5px] hover:bg-cyan-300 disabled:opacity-50 transition-colors"
        >
          {testing ? "Testing…" : "Test ZAR"}
        </button>
      </div>

      <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
        {notice && <NoticeBanner kind="success">{notice}</NoticeBanner>}
        {error && <NoticeBanner kind="error">{error}</NoticeBanner>}

        <div className="text-[11px] uppercase tracking-[0.08em] text-white/50">
          Upload education for {area.title}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={`Paste notes, a transcript, or a summary about ${area.title.toLowerCase()}.`}
          className={textareaClass}
        />
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="block w-full text-[12px] text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-1.5 file:text-black file:font-medium hover:file:bg-cyan-300"
        />
        {files.length > 0 && (
          <div className="text-[11px] text-white/50">
            {files.length} file{files.length === 1 ? "" : "s"} selected
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void feed()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 disabled:opacity-50 transition-colors"
          >
            <Upload size={13} />
            {uploading ? "Adding to ZAR…" : "Add to this section"}
          </button>
        </div>

        {assessment && (
          <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-[12px] text-white/80">{assessment.summary}</div>
            <div className="mt-2 space-y-1">
              {assessment.breakdown.map((b, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11.5px] text-white/55">
                  <span>{b.label}</span>
                  <span className="text-white/70">
                    {b.points}
                    {b.max ? `/${b.max}` : ""}
                  </span>
                </div>
              ))}
            </div>
            {assessment.quiz.length > 0 && (
              <div className="mt-2.5 space-y-2 border-t border-white/[0.06] pt-2.5">
                {assessment.quiz.map((q, i) => (
                  <div key={i} className="text-[11.5px]">
                    <div className="text-white/70">{q.question}</div>
                    <div className="mt-0.5 text-white/50 leading-snug">{q.answer}</div>
                    <div className={`mt-0.5 uppercase tracking-[0.06em] ${verdictClass(q.verdict)}`}>
                      {q.verdict}
                      {q.note ? ` — ${q.note}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
