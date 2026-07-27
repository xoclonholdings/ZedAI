import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BrainCircuit, Loader2 } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

interface NexusMemoryUploadProps {
  readonly onDone: () => void;
}

/**
 * The dock's "Upload" trigger - teaches Zed something, through the same
 * /api/me/memory/upload pipeline the Memory page uses. Unlike Image/Doc,
 * this never needs a conversation: it's not a chat attachment, it's a
 * direct add to the object-memory graph, so zips, datasets, and other
 * "random things Zed should know" go straight into what every
 * conversation can already pull from.
 */
export function NexusMemoryUpload({ onDone }: NexusMemoryUploadProps) {
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch("/api/me/memory/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Upload failed");
      return data;
    },
    onSuccess: (data) => {
      const newObjects = data?.totals?.newObjects ?? 0;
      toast({
        title: newObjects > 0 ? `Learned ${newObjects} thing${newObjects === 1 ? "" : "s"}` : "Nothing new to learn",
        description:
          newObjects > 0
            ? "Zed can pull this into any conversation now."
            : "Zed couldn't extract anything useful from that file.",
      });
      setUploadingCount(0);
      onDone();
    },
    onError: (error) => {
      toast({
        title: "Couldn't learn that",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
      setUploadingCount(0);
    },
  });

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length === 0) return;
    setUploadingCount(files.length);
    uploadMutation.mutate(files);
  }

  const uploading = uploadingCount > 0;

  return (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-black/40 px-4 py-4 text-center transition-colors hover:border-white/30 disabled:cursor-wait"
    >
      {uploading ? (
        <>
          <Loader2 size={18} className="animate-spin text-cyan-300" />
          <span className="text-[13px] text-white/70">
            Teaching Zed from {uploadingCount} {uploadingCount === 1 ? "file" : "files"}...
          </span>
        </>
      ) : (
        <>
          <BrainCircuit size={18} className="text-white/45" />
          <span className="text-[13px] font-medium text-white">Tap to teach Zed something</span>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInput}
        className="hidden"
        accept=".zip,.csv,.txt,.md,.docx,.json,.xlsx,.pdf"
        aria-label="Choose files for Zed to learn from"
      />
    </button>
  );
}
