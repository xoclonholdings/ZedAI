import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

interface NexusFileUploadProps {
  readonly conversationId: string;
  readonly onUpload: (files: File[], result: { conversationId?: string; files?: unknown[] }) => void;
  readonly onClose: () => void;
  /** Restricts the native file picker. Defaults to every type this route accepts. */
  readonly accept?: string;
  /** Client-side type gate matching `accept`. Defaults to every type this route accepts. */
  readonly allowedTypes?: readonly string[];
  readonly label?: string;
}

const MAX_SIZE = 32 * 1024 * 1024 * 1024;
const DEFAULT_ALLOWED_TYPES = [
  "text/plain",
  "text/csv",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/json",
  "text/markdown",
];
const DEFAULT_ACCEPT = ".csv,.xlsx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json";

/**
 * The dock's compact upload trigger - real upload (POST to the conversation's
 * /upload route), sized to fit the same fixed slot the mic/composer occupy,
 * not the full drag-and-drop panel a standalone chat page would show.
 */
export function NexusFileUpload({
  conversationId,
  onUpload,
  onClose,
  accept = DEFAULT_ACCEPT,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  label = "Tap to upload files",
}: NexusFileUploadProps) {
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch(`/api/conversations/${conversationId}/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: (data, files) => {
      const uploadedCount = Array.isArray(data?.files) ? data.files.length : files.length;
      const oneFile = uploadedCount === 1;
      toast({
        title: oneFile ? "File attached" : `${uploadedCount} files attached`,
        description: "Attached to this conversation.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      setUploadingCount(0);
      onUpload(files, data);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
      setUploadingCount(0);
    },
  });

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files?.[0] ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length > 0) handleFiles(files);
  }

  function handleFiles(files: File[]) {
    const validFiles = files.filter((file) => {
      if (file.size > MAX_SIZE) {
        toast({ title: "File too large", description: `${file.name} exceeds 32GB limit`, variant: "destructive" });
        return false;
      }
      if (!allowedTypes.includes(file.type)) {
        toast({ title: "Unsupported file type", description: `${file.name} is not a supported file type`, variant: "destructive" });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;
    setUploadingCount(validFiles.length);
    uploadMutation.mutate(validFiles);
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
            Uploading {uploadingCount} {uploadingCount === 1 ? "file" : "files"}...
          </span>
        </>
      ) : (
        <>
          <Upload size={18} className="text-white/45" />
          <span className="text-[13px] font-medium text-white">{label}</span>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInput}
        className="hidden"
        accept={accept}
        aria-label="Choose files to upload"
      />
    </button>
  );
}
