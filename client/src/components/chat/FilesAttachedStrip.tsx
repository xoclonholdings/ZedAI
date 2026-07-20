import { FileText, FileSpreadsheet, Image as ImageIcon, File as FileIcon } from "lucide-react";
import type { File as DBFile } from "@shared/schema";

/**
 * Visible strip above the composer that shows files attached to the
 * current conversation. Without this, users upload files, see a
 * toast, and have no visual proof anything happened.
 *
 * Empty state is hidden entirely — the strip only renders when
 * there's at least one file.
 */

function iconFor(mimeType: string) {
  if (mimeType?.startsWith("image/")) return ImageIcon;
  if (mimeType?.includes("csv") || mimeType?.includes("sheet") || mimeType?.includes("excel"))
    return FileSpreadsheet;
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

export default function FilesAttachedStrip({ files }: { files: DBFile[] }) {
  if (!files || files.length === 0) return null;

  const label = files.length === 1
    ? "1 file attached to this chat - ZAR can reference it in replies."
    : `${files.length} files attached to this chat - ZAR can reference them in replies.`;

  return (
    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 md:px-4 py-2">
      <div className="max-w-4xl mx-auto">
        <div className="text-[11.5px] uppercase tracking-[0.08em] text-white/40 mb-1.5">
          {label}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {files.map((file) => {
            const Icon = iconFor(file.mimeType || "");
            const displayName = file.originalName || file.fileName;
            const size = formatSize(Number(file.size) || 0);
            return (
              <div
                key={file.id}
                className="shrink-0 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] text-white/80 max-w-[220px]"
                title={`${displayName}${size ? ` - ${size}` : ""}`}
              >
                <Icon size={13} className="shrink-0 text-cyan-400/80" />
                <span className="truncate">{displayName}</span>
                {size && <span className="shrink-0 text-white/40">{size}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
