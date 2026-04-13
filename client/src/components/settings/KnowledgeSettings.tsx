import { useEffect, useState } from "react";
import { Database, Edit3, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type KnowledgeOverview = {
  coreCount: number;
  projectCount: number;
  scratchpadCount: number;
};

type ProjectMemoryDraft = {
  id: string;
  name: string;
  description: string;
  content: string;
  type: string;
  isActive: boolean;
};

type ScratchpadDraft = {
  content: string;
  tags: string;
};

const EMPTY_PROJECT_MEMORY: ProjectMemoryDraft = {
  id: "",
  name: "",
  description: "",
  content: "",
  type: "context",
  isActive: true,
};

const EMPTY_SCRATCHPAD: ScratchpadDraft = {
  content: "",
  tags: "",
};

function LabeledField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border-white/10 bg-black/30 text-sm"
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-white/20 bg-black"
      />
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="zed-glass border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

export default function KnowledgeSettings() {
  const [overview, setOverview] = useState<KnowledgeOverview | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [projectMemoryItems, setProjectMemoryItems] = useState<any[]>([]);
  const [scratchpadItems, setScratchpadItems] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [projectMemoryDraft, setProjectMemoryDraft] = useState<ProjectMemoryDraft>(EMPTY_PROJECT_MEMORY);
  const [projectMemorySaveStatus, setProjectMemorySaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [scratchpadDraft, setScratchpadDraft] = useState<ScratchpadDraft>(EMPTY_SCRATCHPAD);
  const [scratchpadSaveStatus, setScratchpadSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    void refreshKnowledgeData();
  }, []);

  async function refreshKnowledgeData() {
    setLoadingLists(true);
    try {
      const [overviewRes, projectRes, scratchpadRes] = await Promise.all([
        fetch("/api/admin/knowledge/overview", { credentials: "include" }),
        fetch("/api/knowledge/project-memory", { credentials: "include" }),
        fetch("/api/knowledge/scratchpad", { credentials: "include" }),
      ]);

      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (projectRes.ok) {
        const data = await projectRes.json();
        setProjectMemoryItems(data.items || []);
      }
      if (scratchpadRes.ok) {
        const data = await scratchpadRes.json();
        setScratchpadItems(data.items || []);
      }
    } catch {
      // Keep the existing state if refresh fails.
    }
    setLoadingLists(false);
  }

  async function searchKnowledge() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query.trim())}`, {
        credentials: "include",
      });
      if (res.ok) {
        setResults(await res.json());
      }
    } catch {
      // Keep the previous results if a search fails.
    }
    setSearching(false);
  }

  async function saveProjectMemoryItem() {
    if (!projectMemoryDraft.name.trim() || !projectMemoryDraft.content.trim()) {
      setProjectMemorySaveStatus("error");
      return;
    }

    setProjectMemorySaveStatus("saving");
    try {
      const isEditing = Boolean(projectMemoryDraft.id);
      const res = await fetch(
        isEditing ? `/api/knowledge/project-memory/${projectMemoryDraft.id}` : "/api/knowledge/project-memory",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: projectMemoryDraft.name,
            description: projectMemoryDraft.description,
            content: projectMemoryDraft.content,
            type: projectMemoryDraft.type,
            isActive: projectMemoryDraft.isActive,
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to save project memory");

      await refreshKnowledgeData();
      setProjectMemoryDraft(EMPTY_PROJECT_MEMORY);
      setProjectMemorySaveStatus("saved");
      setTimeout(() => setProjectMemorySaveStatus("idle"), 2000);
    } catch {
      setProjectMemorySaveStatus("error");
    }
  }

  async function deleteProjectMemoryItem(id: string) {
    try {
      const res = await fetch(`/api/knowledge/project-memory/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      await refreshKnowledgeData();
      if (projectMemoryDraft.id === id) {
        setProjectMemoryDraft(EMPTY_PROJECT_MEMORY);
      }
    } catch {
      // Non-fatal for now.
    }
  }

  async function saveScratchpadItem() {
    if (!scratchpadDraft.content.trim()) {
      setScratchpadSaveStatus("error");
      return;
    }

    setScratchpadSaveStatus("saving");
    try {
      const res = await fetch("/api/knowledge/scratchpad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: scratchpadDraft.content,
          tags: scratchpadDraft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });

      if (!res.ok) throw new Error("Failed to save scratchpad");

      await refreshKnowledgeData();
      setScratchpadDraft(EMPTY_SCRATCHPAD);
      setScratchpadSaveStatus("saved");
      setTimeout(() => setScratchpadSaveStatus("idle"), 2000);
    } catch {
      setScratchpadSaveStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Knowledge System</h2>
        <p className="text-sm text-muted-foreground">
          Curate durable knowledge, capture temporary working context, and inspect live retrieval from one focused surface.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Core Memory" value={overview?.coreCount ?? "—"} />
        <MetricCard label="Project Memory" value={overview?.projectCount ?? "—"} />
        <MetricCard label="Scratchpad" value={overview?.scratchpadCount ?? "—"} />
      </div>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database size={16} className="text-cyan-300" />
                Knowledge Retrieval
              </CardTitle>
              <CardDescription>Search rules, foundation memory, project memory, scratchpad, and semantic recall.</CardDescription>
            </div>
            <Button variant="outline" className="border-white/10" onClick={refreshKnowledgeData} disabled={loadingLists}>
              <RefreshCw size={14} className={`mr-1 ${loadingLists ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search knowledge…"
              className="border-white/10 bg-black/30 text-sm"
            />
            <Button onClick={searchKnowledge} disabled={searching}>
              <RefreshCw size={14} className={`mr-1 ${searching ? "animate-spin" : ""}`} />
              {searching ? "Searching..." : "Search"}
            </Button>
          </div>

          {results ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Foundation + Rules</p>
                  <div className="whitespace-pre-wrap text-sm text-foreground/85">
                    {results.foundation || results.core || "No foundation or ruleset matches found."}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Retrieved Memory</p>
                  <div className="space-y-3 text-sm text-foreground/85">
                    {(results.retrieved || []).length > 0 ? (
                      results.retrieved.map((item: any) => (
                        <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-cyan-300">{item.source}</div>
                          <div>{item.excerpt}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">No retrieved semantic or episodic matches.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Project Memory</p>
                  <div className="space-y-3 text-sm text-foreground/85">
                    {(results.project || []).length > 0 ? (
                      results.project.map((item: any) => (
                        <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="mb-1 font-medium">{item.name}</div>
                          {item.description ? <div className="mb-1 text-muted-foreground">{item.description}</div> : null}
                          <div>{item.excerpt}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">No project memory matches.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Scratchpad Memory</p>
                  <div className="space-y-3 text-sm text-foreground/85">
                    {(results.scratchpad || []).length > 0 ? (
                      results.scratchpad.map((item: any) => (
                        <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                          {item.tags?.length > 0 ? (
                            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-purple-300">{item.tags.join(" • ")}</div>
                          ) : null}
                          <div>{item.excerpt}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">No scratchpad matches.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="zed-glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus size={16} className="text-emerald-300" />
              Project Memory Editor
            </CardTitle>
            <CardDescription>
              Store durable business, product, and operating knowledge that ZED should retrieve later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <LabeledField
                label="Name"
                value={projectMemoryDraft.name}
                onChange={(value) => setProjectMemoryDraft((prev) => ({ ...prev, name: value }))}
                placeholder="ZWAP Go-To-Market"
              />
              <LabeledField
                label="Type"
                value={projectMemoryDraft.type}
                onChange={(value) => setProjectMemoryDraft((prev) => ({ ...prev, type: value }))}
                placeholder="context"
              />
            </div>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Description</span>
              <Textarea
                rows={3}
                value={projectMemoryDraft.description}
                onChange={(e) => setProjectMemoryDraft((prev) => ({ ...prev, description: e.target.value }))}
                className="zed-glass border-white/10 text-sm"
                placeholder="Why this knowledge matters"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Content</span>
              <Textarea
                rows={10}
                value={projectMemoryDraft.content}
                onChange={(e) => setProjectMemoryDraft((prev) => ({ ...prev, content: e.target.value }))}
                className="zed-glass border-white/10 text-sm"
                placeholder="Write the durable knowledge ZED should remember"
              />
            </label>
            <ToggleField
              label="Active"
              checked={projectMemoryDraft.isActive}
              onChange={(next) => setProjectMemoryDraft((prev) => ({ ...prev, isActive: next }))}
              description="Inactive entries remain stored but won’t be prioritized."
            />
            <div className="flex items-center gap-3">
              <Button onClick={saveProjectMemoryItem}>
                <Save size={14} className="mr-1" />
                {projectMemorySaveStatus === "saving"
                  ? "Saving..."
                  : projectMemoryDraft.id
                    ? "Update Memory"
                    : "Create Memory"}
              </Button>
              {projectMemoryDraft.id ? (
                <Button variant="outline" className="border-white/10" onClick={() => setProjectMemoryDraft(EMPTY_PROJECT_MEMORY)}>
                  Cancel Edit
                </Button>
              ) : null}
              {projectMemorySaveStatus === "error" ? (
                <span className="text-xs text-red-400">Name and content are required.</span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="zed-glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Edit3 size={16} className="text-purple-300" />
              Scratchpad Capture
            </CardTitle>
            <CardDescription>
              Store temporary working context that should influence near-term reasoning without becoming permanent canon.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Working Note</span>
              <Textarea
                rows={10}
                value={scratchpadDraft.content}
                onChange={(e) => setScratchpadDraft((prev) => ({ ...prev, content: e.target.value }))}
                className="zed-glass border-white/10 text-sm"
                placeholder="Capture active priorities, temporary facts, or immediate session context"
              />
            </label>
            <LabeledField
              label="Tags"
              value={scratchpadDraft.tags}
              onChange={(value) => setScratchpadDraft((prev) => ({ ...prev, tags: value }))}
              placeholder="launch, zwap, campaign"
            />
            <div className="flex items-center gap-3">
              <Button onClick={saveScratchpadItem}>
                <Save size={14} className="mr-1" />
                {scratchpadSaveStatus === "saving" ? "Saving..." : "Save Scratchpad"}
              </Button>
              {scratchpadSaveStatus === "error" ? (
                <span className="text-xs text-red-400">Scratchpad content is required.</span>
              ) : null}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-xs leading-5 text-muted-foreground">
              Scratchpad entries expire automatically and are meant for active work, not permanent foundational knowledge.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="zed-glass border-white/10">
          <CardHeader>
            <CardTitle className="text-base">Stored Project Memory</CardTitle>
            <CardDescription>Edit or remove durable knowledge entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingLists ? (
              <div className="text-sm text-muted-foreground">Loading memory…</div>
            ) : projectMemoryItems.length > 0 ? (
              projectMemoryItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.type}
                        {item.description ? ` • ${item.description}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10"
                        onClick={() =>
                          setProjectMemoryDraft({
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
                        onClick={() => deleteProjectMemoryItem(item.id)}
                      >
                        <Trash2 size={12} className="mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-foreground/85 whitespace-pre-wrap">{item.content}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No project memory stored yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="zed-glass border-white/10">
          <CardHeader>
            <CardTitle className="text-base">Active Scratchpad</CardTitle>
            <CardDescription>Temporary working memory currently available for retrieval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingLists ? (
              <div className="text-sm text-muted-foreground">Loading scratchpad…</div>
            ) : scratchpadItems.length > 0 ? (
              scratchpadItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-2 text-xs text-muted-foreground">
                    {item.tags?.length ? item.tags.join(" • ") : "untagged"}
                  </div>
                  <div className="text-sm text-foreground/85 whitespace-pre-wrap">{item.content}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No scratchpad entries stored yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
