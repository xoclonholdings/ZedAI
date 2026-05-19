import { Edit3, Plus, Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { LabeledInput } from "./atoms";
import {
  EMPTY_PROJECT_MEMORY,
  type ProjectMemoryDraft,
  type SaveStatus,
} from "./types";

export function ProjectView({
  items,
  draft,
  setDraft,
  status,
  onSave,
  onDelete,
}: {
  items: any[];
  draft: ProjectMemoryDraft;
  setDraft: (next: ProjectMemoryDraft | ((prev: ProjectMemoryDraft) => ProjectMemoryDraft)) => void;
  status: SaveStatus;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus size={16} className="text-emerald-300" />
            Durable Project Memory
          </CardTitle>
          <CardDescription>
            Store long-lived business, product, and operating knowledge that ZED should retrieve
            consistently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <LabeledInput
              label="Name"
              value={draft.name}
              onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))}
              placeholder="ZWAP launch narrative"
            />
            <LabeledInput
              label="Description"
              value={draft.description}
              onChange={(value) => setDraft((prev) => ({ ...prev, description: value }))}
              placeholder="Why this memory matters"
            />
          </div>
          <label className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Memory Type
            </div>
            <Select
              value={draft.type}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value }))}
            >
              <SelectTrigger className="border-white/10 bg-black/30 text-sm">
                <SelectValue placeholder="Select memory type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="context">Context</SelectItem>
                <SelectItem value="strategy">Strategy</SelectItem>
                <SelectItem value="identity">Identity</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="profile">Profile</SelectItem>
                <SelectItem value="goals">Goals</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Content
            </div>
            <Textarea
              rows={14}
              value={draft.content}
              onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
              className="zed-glass border-white/10 text-sm"
              placeholder="Write the durable knowledge ZED should retain and retrieve later."
            />
          </label>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Active Memory</div>
              <div className="text-xs text-muted-foreground">
                Inactive entries stay archived but are not prioritized during retrieval.
              </div>
            </div>
            <Switch
              checked={draft.isActive}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isActive: checked }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onSave}>
              <Save size={14} className="mr-2" />
              {status === "saving"
                ? "Saving..."
                : draft.id
                  ? "Update Memory"
                  : "Create Memory"}
            </Button>
            {draft.id ? (
              <Button
                variant="outline"
                className="border-white/10"
                onClick={() => setDraft(EMPTY_PROJECT_MEMORY)}
              >
                Cancel Edit
              </Button>
            ) : null}
            {status === "error" ? (
              <span className="text-xs text-red-400">Name and content are required.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Stored Project Memory</CardTitle>
          <CardDescription>Review, edit, or remove durable memory entries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className="border-white/10 bg-black/30 text-[10px] uppercase tracking-[0.14em]"
                      >
                        {item.type || "context"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          item.isActive
                            ? "border-emerald-400/30 text-emerald-300"
                            : "border-white/10 text-muted-foreground"
                        }
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {item.description ? (
                      <div className="text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10"
                      onClick={() =>
                        setDraft({
                          id: item.id,
                          name: item.name,
                          description: item.description || "",
                          content: item.content,
                          type: item.type || "context",
                          isActive: item.isActive ?? true,
                        })
                      }
                    >
                      <Edit3 size={12} className="mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/20 text-red-300 hover:bg-red-500/10"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 size={12} className="mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-sm text-foreground/85">
                  {item.content}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No project memory stored yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
