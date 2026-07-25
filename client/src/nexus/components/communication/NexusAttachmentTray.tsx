import { File as FileIcon, FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react";

import type { File as DBFile } from "@shared/schema";

function iconFor(mimeType: string) {
  if (mimeType?.startsWith("image/")) return ImageIcon;
  if (mimeType?.includes("csv") || mimeType?.includes("sheet") || mimeType?.includes("excel")) {
    return FileSpreadsheet;
  }
  if (mimeType?.startsWith("text/") || mimeType?.includes("pdf")) return FileText;
  return FileIcon;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function NexusAttachmentTray({ files }: { readonly files: readonly DBFile[] }) {
  if (!files || files.length === 0) return null;

  const label = files.length === 1
    ? "1 file attached to this conversation"
    : `${files.length} files attached to this conversation`;

  return (
    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-2 md:px-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-1.5 text-[11.5px] uppercase tracking-[0.08em] text-white/40">
          {label}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {files.map((file) => {
            const Icon = iconFor(file.mimeType || "");
            const displayName = file.originalName || file.fileName;
            const size = formatSize(Number(file.size) || 0);
            return (
              <div
                key={file.id}
                className="flex max-w-[220px] shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[12.5px] text-white/80"
                title={`${displayName}${size ? ` - ${size}` : ""}`}
              >
                <Icon size={13} className="shrink-0 text-cyan-300/75" />
                <span className="truncate">{displayName}</span>
                {size ? <span className="shrink-0 text-white/40">{size}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
