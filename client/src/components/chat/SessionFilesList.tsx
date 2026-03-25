import { File } from "lucide-react";
import type { File as FileType } from "@shared/schema";
import SessionFileItem from "./SessionFileItem";

interface SessionFilesListProps {
  files: FileType[];
}

export default function SessionFilesList({ files }: SessionFilesListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 zed-avatar rounded-2xl flex items-center justify-center mx-auto mb-4">
          <File size={24} className="text-white" />
        </div>
        <p className="text-sm text-muted-foreground mb-2">No files uploaded</p>
        <p className="text-xs text-muted-foreground/60">
          Drag & drop files to analyze
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <SessionFileItem key={file.id} file={file} />
      ))}
    </div>
  );
}