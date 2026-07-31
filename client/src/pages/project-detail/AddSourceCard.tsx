import { useRef, useState } from "react";
import { Loader2, Plus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { AddSourceMode } from "./types";

/**
 * Three-mode source adder: file upload (multipart), URL reference,
 * or pasted text snippet. Posts to /api/projects/:id/sources and
 * tells the parent to refetch on success.
 */
export function AddSourceCard({
  projectId,
  onAdded,
  onError,
  onCancel,
}: {
  projectId: string;
  onAdded: () => Promise<void>;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<AddSourceMode>("file");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setSubmitting(true);
    try {
      let res: Response;
      if (mode === "file") {
        const file = fileInputRef.current?.files?.[0];
        if (!file) throw new Error("Pick a file first");
        const fd = new FormData();
        fd.append("file", file);
        if (label) fd.append("label", label);
        if (notes) fd.append("notes", notes);
        res = await fetch(`/api/projects/${projectId}/sources`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });
      } else {
        const payload: any = {
          label: label || (mode === "url" ? url : "Snippet"),
          notes: notes || undefined,
        };
        if (mode === "url") payload.url = url;
        if (mode === "text") payload.text = text;
        res = await fetch(`/api/projects/${projectId}/sources`, {
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
      setLabel("");
      setUrl("");
      setText("");
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await onAdded();
      onCancel();
    } catch (e: any) {
      onError(e?.message || "Failed to add source");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="zar-glass border-white/10">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex gap-1.5">
          {(["file", "url", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                mode === m
                  ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "file" ? "File" : m === "url" ? "URL" : "Text"}
            </button>
          ))}
        </div>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="zar-glass border-white/10 h-9 text-sm"
          placeholder="Label (e.g. Brand voice doc)"
        />
        {mode === "file" && (
          <Input ref={fileInputRef} type="file" className="zar-glass border-white/10 text-xs" />
        )}
        {mode === "url" && (
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="zar-glass border-white/10 h-9 text-sm font-mono"
            placeholder="https://…"
          />
        )}
        {mode === "text" && (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="zar-glass border-white/10 text-sm"
            placeholder="Paste a snippet the agents should know about…"
          />
        )}
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="zar-glass border-white/10 h-9 text-sm"
          placeholder="Notes (optional)"
        />
        <Button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {submitting ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : mode === "file" ? (
            <Upload size={14} className="mr-2" />
          ) : (
            <Plus size={14} className="mr-2" />
          )}
          Add source
        </Button>
      </CardContent>
    </Card>
  );
}
