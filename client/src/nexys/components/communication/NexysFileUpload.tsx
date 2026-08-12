import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { uploadRequest } from "@/lib/uploadRequest";
import {
  EXTRACTABLE_UPLOAD_ACCEPT,
  EXTRACTABLE_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MAX_UPLOAD_FILE_SIZE_LABEL,
} from "@shared/upload-policy";

interface NexysFileUploadProps {
  readonly conversationId?: string;
  readonly ensureConversation?: (titleSeed?: string) => Promise<string | undefined>;
  readonly onUpload: (files: File[], result: { conversationId?: string; files?: unknown[] }) => void;
  readonly onClose: () => void;
  /** Restricts the native file picker. Defaults to every type this route accepts. */
  readonly accept?: string;
  /** Client-side type gate matching `accept`. Defaults to every type this route accepts. */
  readonly allowedTypes?: readonly string[];
  readonly label?: string;
}

const DEFAULT_ALLOWED_TYPES = EXTRACTABLE_UPLOAD_MIME_TYPES;
const DEFAULT_ACCEPT = EXTRACTABLE_UPLOAD_ACCEPT;

/**
 * The dock's compact upload trigger - real upload (POST to the conversation's
 * /upload route), sized to fit the same fixed slot the mic/composer occupy,
 * not the full drag-and-drop panel a standalone chat page would show.
 */
export function NexysFileUpload({
  conversationId,
  ensureConversation,
  onUpload,
  onClose,
  accept = DEFAULT_ACCEPT,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  label = "Tap to upload files",
}: NexysFileUploadProps) {
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const targetConversationId = conversationId || await ensureConversation?.(
        files[0]?.name || "Attachment",
      );
      if (!targetConversationId) throw new Error("Could not start a conversation for this upload.");
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const data = await uploadRequest<{ conversationId?: string; files?: unknown[]; warnings?: Array<{ warning: string }> }>(
        `/api/conversations/${targetConversationId}/upload`,
        formData,
      );
      return { ...data, conversationId: data.conversationId || targetConversationId };
    },
    onSuccess: (data, files) => {
      const uploadedConversationId = data.conversationId || conversationId;
      const uploadedCount = Array.isArray(data?.files) ? data.files.length : files.length;
      const oneFile = uploadedCount === 1;
      toast({
        title: oneFile ? "File attached" : `${uploadedCount} files attached`,
        description: data?.warnings?.length
          ? data.warnings.map((warning) => warning.warning).join(" ")
          : "Attached to this conversation.",
      });

      if (uploadedConversationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", uploadedConversationId, "files"] });
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", uploadedConversationId] });
      }
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
    const acceptedExtensions = accept
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.startsWith("."));
    const validFiles = files.filter((file) => {
      if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
        toast({ title: "File too large", description: `${file.name} exceeds the ${MAX_UPLOAD_FILE_SIZE_LABEL} limit.`, variant: "destructive" });
        return false;
      }
      const lowerName = file.name.toLowerCase();
      const acceptedByExtension = acceptedExtensions.some((extension) =>
        lowerName.endsWith(extension),
      );
      if (!allowedTypes.includes(file.type) && !acceptedByExtension) {
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
