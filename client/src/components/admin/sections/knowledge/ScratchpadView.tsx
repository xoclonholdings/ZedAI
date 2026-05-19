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
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Edit3 size={16} className="text-purple-300" />
            Temporary Working Memory
          </CardTitle>
          <CardDescription>
            Capture near-term operating context without polluting the permanent knowledge base.
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
              className="zed-glass border-white/10 text-sm"
              placeholder="Capture active priorities, immediate context, temporary findings, or session-only details."
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
            Scratchpad memory is for immediate work. It should be trimmed aggressively and only
            promoted into durable memory when it becomes stable knowledge.
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Active Scratchpad Entries</CardTitle>
          <CardDescription>
            Review and clear temporary context that is still influencing retrieval.
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
                      <div className="text-xs text-muted-foreground">Untagged temporary note</div>
                    )}
                    {item.expiresAt ? (
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Expires {new Date(item.expiresAt).toLocaleString()}
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
                    Clear
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
