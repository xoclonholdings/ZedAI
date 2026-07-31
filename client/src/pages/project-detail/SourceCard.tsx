import { ExternalLink, FileText, Link as LinkIcon, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import type { ProjectSource } from "./types";

export function SourceCard({
  source,
  onRemove,
}: {
  source: ProjectSource;
  onRemove: () => void;
}) {
  return (
    <Card className="zar-glass border-white/10">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0">
            {source.url ? (
              <LinkIcon size={13} className="text-cyan-300" />
            ) : (
              <FileText size={13} className="text-purple-300" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{source.label}</span>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 hover:text-cyan-200"
                >
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
            {source.url && (
              <p className="text-[11px] font-mono text-muted-foreground truncate">{source.url}</p>
            )}
            {source.text && (
              <p className="text-[11px] text-muted-foreground/90 line-clamp-2 leading-5 mt-0.5">
                {source.text}
              </p>
            )}
            {source.notes && (
              <p className="text-[11px] italic text-muted-foreground/80 mt-0.5">{source.notes}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-red-300 shrink-0"
            aria-label="Remove source"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
