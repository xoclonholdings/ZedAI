import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, File, FileSpreadsheet, FileText, Image, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface NexusFileUploadProps {
  readonly conversationId: string;
  readonly onUpload: (files: File[], result: { conversationId?: string; files?: unknown[] }) => void;
  readonly onClose: () => void;
}

interface UploadingFile {
  readonly file: File;
  readonly progress: number;
  readonly status: "uploading" | "processing" | "completed" | "error";
  readonly error?: string;
}

export function NexusFileUpload({ conversationId, onUpload, onClose }: NexusFileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
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
        description: oneFile
          ? "Attached to this conversation."
          : "Attached to this conversation.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      onUpload(files, data);
      setUploadingFiles([]);
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
      setUploadingFiles([]);
    },
  });

  function handleDrag(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") setDragActive(true);
    if (event.type === "dragleave") setDragActive(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (event.dataTransfer.files?.[0]) handleFiles(Array.from(event.dataTransfer.files));
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.[0]) handleFiles(Array.from(event.target.files));
  }

  function handleFiles(files: File[]) {
    const validFiles = files.filter((file) => {
      const maxSize = 32 * 1024 * 1024 * 1024;
      const allowedTypes = [
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

      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 32GB limit`,
          variant: "destructive",
        });
        return false;
      }

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Unsupported file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive",
        });
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) return;

    const newUploadingFiles = validFiles.map((file) => ({
      file,
      progress: 0,
      status: "uploading" as const,
    }));
    setUploadingFiles(newUploadingFiles);

    newUploadingFiles.forEach((_uploadingFile, index) => {
      const interval = setInterval(() => {
        setUploadingFiles((previous) =>
          previous.map((uploadingFile, candidateIndex) =>
            candidateIndex === index
              ? { ...uploadingFile, progress: Math.min(uploadingFile.progress + 10, 90) }
              : uploadingFile,
          ),
        );
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        setUploadingFiles((previous) =>
          previous.map((uploadingFile, candidateIndex) =>
            candidateIndex === index
              ? { ...uploadingFile, progress: 100, status: "processing" }
              : uploadingFile,
          ),
        );
      }, 1000);
    });

    uploadMutation.mutate(validFiles);
  }

  return (
    <div className="border-t border-white/[0.08] bg-black/55 p-3 md:p-4">
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Attach files</h3>
            <p className="mt-1 text-xs text-white/50">Images, documents, text, CSV, and PDF are supported.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white/52 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close file upload"
          >
            <X size={16} />
          </Button>
        </div>

        <div
          className={`rounded-xl border border-dashed p-6 text-center transition-colors ${
            dragActive
              ? "border-cyan-300/55 bg-cyan-300/[0.07]"
              : "border-white/15 hover:border-white/30"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <Upload className="mx-auto mb-3 text-white/45" size={32} />
          <p className="text-sm font-medium text-white">Drop files here or choose files</p>
          <p className="mt-1 text-xs text-white/45">Files attach to this conversation.</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInput}
            className="hidden"
            accept=".csv,.xlsx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json"
            aria-label="Choose files to upload"
          />
        </div>

        {uploadingFiles.length > 0 ? (
          <div className="mt-4 space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-white/45">
              Uploading
            </h4>
            {uploadingFiles.map((uploadingFile, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <div className="flex items-center gap-3">
                  <div className="text-white/45">{getFileIcon(uploadingFile.file)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{uploadingFile.file.name}</p>
                    <p className="text-xs text-white/45">{formatFileSize(uploadingFile.file.size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadingFile.status === "completed" ? (
                      <CheckCircle className="text-green-400" size={16} />
                    ) : null}
                    {uploadingFile.status === "error" ? (
                      <AlertCircle className="text-red-400" size={16} />
                    ) : null}
                    <span className="text-xs capitalize text-white/45">{uploadingFile.status}</span>
                  </div>
                </div>
                {uploadingFile.status === "uploading" ? (
                  <div className="mt-2">
                    <Progress value={uploadingFile.progress} className="h-1" />
                  </div>
                ) : null}
                {uploadingFile.error ? (
                  <p className="mt-2 text-xs text-red-300">{uploadingFile.error}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getFileIcon(file: File) {
  if (file.type.startsWith("image/")) return <Image size={16} />;
  if (file.type.includes("csv") || file.type.includes("excel")) return <FileSpreadsheet size={16} />;
  if (file.type === "text/plain") return <FileText size={16} />;
  return <File size={16} />;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const unit = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(unit));
  return `${parseFloat((bytes / Math.pow(unit, index)).toFixed(2))} ${sizes[index]}`;
}
