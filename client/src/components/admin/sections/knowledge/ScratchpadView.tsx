import { Edit3, Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { LabeledInput } from "./atoms";
import type { SaveStatus, ScratchpadDraft } from "./types";

export function ScratchpadView({
  items,
  draft,
  setDraft,
  status,
  onSave,
  onDelete,
}: {
  items: any[];
  draft: ScratchpadDraft;
  setDraft: (next: ScratchpadDraft | ((prev: ScratchpadDraft) => ScratchpadDraft)) => void;
  status: SaveStatus;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="zar-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Edit3 size={16} className="text-purple-300" />
            Persistent Working Notes
          </CardTitle>
          <CardDescription>
            Capture active operating context that ZAR should keep across sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Working Note
            </div>
            <Textarea
              rows={12}
              value={draft.content}
              onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
              className="zar-glass border-white/10 text-sm"
              placeholder="Capture active priorities, immediate context, findings, or decisions ZAR should retain."
            />
          </label>
          <LabeledInput
            label="Tags"
            value={draft.tags}
            onChange={(value) => setDraft((prev) => ({ ...prev, tags: value }))}
            placeholder="launch, zwap, campaign"
          />
          <div className="flex items-center gap-3">
            <Button onClick={onSave}>
              <Save size={14} className="mr-2" />
              {status === "saving" ? "Saving..." : "Save Scratchpad"}
            </Button>
            {status === "error" ? (
              <span className="text-xs text-red-400">Scratchpad content is required.</span>
            ) : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-muted-foreground">
            Working notes persist as part of ZAR's operating memory unless you explicitly delete them.
          </div>
        </CardContent>
      </Card>

      <Card className="zar-glass border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Saved Working Notes</CardTitle>
          <CardDescription>
            Review persistent context that is still influencing retrieval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    {item.tags?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="border-purple-400/25 text-purple-300"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Untagged working note</div>
                    )}
                    {item.expiresAt ? (
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Persistent
                      </div>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/20 text-red-300 hover:bg-red-500/10"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 size={12} className="mr-1" />
                    Delete note
                  </Button>
                </div>
                <div className="whitespace-pre-wrap text-sm text-foreground/85">
                  {item.content}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No scratchpad entries stored yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
