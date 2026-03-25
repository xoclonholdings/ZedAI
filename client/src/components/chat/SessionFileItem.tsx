import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import type { File as FileType } from "@shared/schema";

interface SessionFileItemProps {
  file: FileType;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "📷";
  if (mimeType.includes("csv") || mimeType.includes("excel")) return "📊";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType === "text/plain") return "📝";
  return "📁";
}

export default function SessionFileItem({ file }: SessionFileItemProps) {
  return (
    <Card className="zed-message p-3 hover:zed-glow transition-all duration-300">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-8 h-8 zed-avatar rounded-xl flex items-center justify-center">
          <span className="text-sm">{getFileIcon(file.mimeType)}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {file.originalName}
          </p>

          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">
              {formatFileSize(file.size)}
            </span>

            <span
              className={`px-2 py-0.5 rounded border text-xs ${
                file.status === "completed"
                  ? "bg-green-600/20 text-green-400 border-green-400/30"
                  : file.status === "processing"
                  ? "bg-yellow-600/20 text-yellow-400 border-yellow-400/30"
                  : "bg-red-600/20 text-red-400 border-red-400/30"
              }`}
            >
              {file.status}
            </span>
          </div>
        </div>
      </div>

      {file.status === "completed" && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full zed-button rounded-xl text-xs h-8"
        >
          <ExternalLink size={12} className="mr-1" />
          View Analysis
        </Button>
      )}
    </Card>
  );
}