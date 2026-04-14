import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Database, Edit3, FileStack, Layers, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type KnowledgeOverview = { coreCount: number; projectCount: number; scratchpadCount: number };
type SearchResults = { foundation?: string; core?: string; retrieved?: any[]; project?: any[]; scratchpad?: any[] };
type ProjectMemoryDraft = { id: string; name: string; description: string; content: string; type: string; isActive: boolean };
type ScratchpadDraft = { content: string; tags: string };
type CoreMemoryDraft = { key: string; description: string; value: string; adminOnly: boolean };
type KnowledgeView = "overview" | "project" | "scratchpad" | "core";
type FoundationProfile = {
  company: string;
  mission: string;
  products: string;
  audience: string;
  brand: string;
  principles: string;
  priorities: string;
};

const EMPTY_PROJECT_MEMORY: ProjectMemoryDraft = { id: "", name: "", description: "", content: "", type: "context", isActive: true };
const EMPTY_SCRATCHPAD: ScratchpadDraft = { content: "", tags: "" };
const EMPTY_CORE_MEMORY: CoreMemoryDraft = { key: "", description: "", value: "", adminOnly: true };
const EMPTY_FOUNDATION_PROFILE: FoundationProfile = {
  company: "",
  mission: "",
  products: "",
  audience: "",
  brand: "",
  principles: "",
  priorities: "",
};

const VIEW_META: Record<KnowledgeView, { label: string; description: string; icon: typeof BrainCircuit }> = {
  overview: { label: "Overview", description: "Inspect knowledge health and retrieval quality.", icon: BrainCircuit },
  project: { label: "Project Memory", description: "Manage durable business and product knowledge.", icon: Database },
  scratchpad: { label: "Scratchpad", description: "Capture and prune temporary working context.", icon: FileStack },
  core: { label: "Core Memory", description: "Edit canonical memory entries used by ZED.", icon: Layers },
};

function SectionIntro({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="zed-glass border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-foreground/85">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

function ViewButton({ active, label, description, icon: Icon, onClick }: { active: boolean; label: string; description: string; icon: typeof BrainCircuit; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-4 py-3 text-left transition-all",
        active ? "border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]" : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border border-white/10 bg-black/40 p-2">
          <Icon size={15} className={active ? "text-cyan-300" : "text-foreground/70"} />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs leading-5 text-muted-foreground">{description}</div>
        </div>
      </div>
    </button>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="border-white/10 bg-black/30 text-sm" />
    </label>
  );
}

function serializeFoundationProfile(profile: FoundationProfile) {
  return [
    `## Company\n${profile.company.trim() || "Not provided yet."}`,
    `## Mission\n${profile.mission.trim() || "Not provided yet."}`,
    `## Products & Ventures\n${profile.products.trim() || "Not provided yet."}`,
    `## Audience\n${profile.audience.trim() || "Not provided yet."}`,
    `## Brand Voice\n${profile.brand.trim() || "Not provided yet."}`,
    `## Operating Principles\n${profile.principles.trim() || "Not provided yet."}`,
    `## Strategic Priorities\n${profile.priorities.trim() || "Not provided yet."}`,
  ].join("\n\n");
}

function extractSection(content: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`## ${escaped}\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
  const match = content.match(regex);
  return match?.[1]?.trim() || "";
}

function parseFoundationProfile(content: string): FoundationProfile {
  if (!content.includes("## ")) {
    return { ...EMPTY_FOUNDATION_PROFILE, company: content.trim() };
  }
  return {
    company: extractSection(content, "Company"),
    mission: extractSection(content, "Mission"),
    products: extractSection(content, "Products & Ventures"),
    audience: extractSection(content, "Audience"),
    brand: extractSection(content, "Brand Voice"),
    principles: extractSection(content, "Operating Principles"),
    priorities: extractSection(content, "Strategic Priorities"),
  };
}

export default function KnowledgeSettings() {
  const [view, setView] = useState<KnowledgeView>("overview");
  const [overview, setOverview] = useState<KnowledgeOverview | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [projectMemoryItems, setProjectMemoryItems] = useState<any[]>([]);
  const [scratchpadItems, setScratchpadItems] = useState<any[]>([]);
  const [coreMemoryItems, setCoreMemoryItems] = useState<any[]>([]);
  const [projectDraft, setProjectDraft] = useState<ProjectMemoryDraft>(EMPTY_PROJECT_MEMORY);
  const [scratchpadDraft, setScratchpadDraft] = useState<ScratchpadDraft>(EMPTY_SCRATCHPAD);
  const [coreDraft, setCoreDraft] = useState<CoreMemoryDraft>(EMPTY_CORE_MEMORY);
  const [foundationProfile, setFoundationProfile] = useState<FoundationProfile>(EMPTY_FOUNDATION_PROFILE);
  const [projectStatus, setProjectStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [scratchpadStatus, setScratchpadStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [coreStatus, setCoreStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [foundationStatus, setFoundationStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const retrievedCount = useMemo(() => (results?.retrieved || []).length, [results]);
  const foundationPreview = useMemo(() => serializeFoundationProfile(foundationProfile), [foundationProfile]);

  useEffect(() => {
    void refreshKnowledgeData();
  }, []);

  async function refreshKnowledgeData() {
    setRefreshing(true);
    try {
      const [overviewRes, projectRes, scratchpadRes, coreRes] = await Promise.all([
        fetch("/api/admin/knowledge/overview", { credentials: "include" }),
        fetch("/api/knowledge/project-memory", { credentials: "include" }),
        fetch("/api/knowledge/scratchpad", { credentials: "include" }),
        fetch("/api/knowledge/core-memory", { credentials: "include" }),
      ]);
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (projectRes.ok) setProjectMemoryItems((await projectRes.json()).items || []);
      if (scratchpadRes.ok) setScratchpadItems((await scratchpadRes.json()).items || []);
      if (coreRes.ok) {
        const items = (await coreRes.json()).items || [];
        setCoreMemoryItems(items);
        const foundationEntry = items.find((item: any) => item.key === "foundation_profile");
        if (foundationEntry?.value) {
          setFoundationProfile(parseFoundationProfile(String(foundationEntry.value)));
        }
      }
    } catch {}
    setRefreshing(false);
  }

  async function searchKnowledge() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query.trim())}`, { credentials: "include" });
      if (res.ok) setResults(await res.json());
    } catch {}
    setSearching(false);
  }

  async function saveProjectMemory() {
    if (!projectDraft.name.trim() || !projectDraft.content.trim()) {
      setProjectStatus("error");
      return;
    }
    setProjectStatus("saving");
    try {
      const isEditing = Boolean(projectDraft.id);
      const res = await fetch(
        isEditing ? `/api/knowledge/project-memory/${projectDraft.id}` : "/api/knowledge/project-memory",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: projectDraft.name,
            description: projectDraft.description,
            content: projectDraft.content,
            type: projectDraft.type,
            isActive: projectDraft.isActive,
          }),
        },
      );
      if (!res.ok) throw new Error("save failed");
      await refreshKnowledgeData();
      setProjectDraft(EMPTY_PROJECT_MEMORY);
      setProjectStatus("saved");
      setTimeout(() => setProjectStatus("idle"), 1800);
    } catch {
      setProjectStatus("error");
    }
  }

  async function deleteProjectMemory(id: string) {
    try {
      const res = await fetch(`/api/knowledge/project-memory/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("delete failed");
      await refreshKnowledgeData();
      if (projectDraft.id === id) setProjectDraft(EMPTY_PROJECT_MEMORY);
    } catch {}
  }

  async function saveScratchpad() {
    if (!scratchpadDraft.content.trim()) {
      setScratchpadStatus("error");
      return;
    }
    setScratchpadStatus("saving");
    try {
      const res = await fetch("/api/knowledge/scratchpad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: scratchpadDraft.content,
          tags: scratchpadDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      await refreshKnowledgeData();
      setScratchpadDraft(EMPTY_SCRATCHPAD);
      setScratchpadStatus("saved");
      setTimeout(() => setScratchpadStatus("idle"), 1800);
    } catch {
      setScratchpadStatus("error");
    }
  }

  async function deleteScratchpad(id: string) {
    try {
      const res = await fetch(`/api/knowledge/scratchpad/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("delete failed");
      await refreshKnowledgeData();
    } catch {}
  }

  async function saveCoreMemory() {
    if (!coreDraft.key.trim() || !coreDraft.value.trim()) {
      setCoreStatus("error");
      return;
    }
    setCoreStatus("saving");
    try {
      const res = await fetch(`/api/knowledge/core-memory/${encodeURIComponent(coreDraft.key.trim())}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          description: coreDraft.description,
          value: coreDraft.value,
          adminOnly: coreDraft.adminOnly,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      await refreshKnowledgeData();
      setCoreStatus("saved");
      setTimeout(() => setCoreStatus("idle"), 1800);
    } catch {
      setCoreStatus("error");
    }
  }

  async function saveFoundationProfile() {
    setFoundationStatus("saving");
    try {
      const res = await fetch("/api/knowledge/core-memory/foundation_profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          description: "Structured global foundation profile for company, products, mission, audience, and operating principles.",
          value: foundationPreview,
          adminOnly: true,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      await refreshKnowledgeData();
      setFoundationStatus("saved");
      setTimeout(() => setFoundationStatus("idle"), 1800);
    } catch {
      setFoundationStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <SectionIntro
        title="Knowledge Control Center"
        description="Manage the memory layers that make ZED useful: inspect retrieval quality, curate durable project knowledge, clear temporary scratchpad context, and maintain canonical core memory without losing operational detail."
        action={
          <Button variant="outline" className="border-white/10" onClick={refreshKnowledgeData} disabled={refreshing}>
            <RefreshCw size={14} className={`mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        {(Object.keys(VIEW_META) as KnowledgeView[]).map((key) => (
          <ViewButton key={key} active={view === key} label={VIEW_META[key].label} description={VIEW_META[key].description} icon={VIEW_META[key].icon} onClick={() => setView(key)} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Core Memory" value={overview?.coreCount ?? "—"} />
        <MetricCard label="Project Memory" value={overview?.projectCount ?? "—"} />
        <MetricCard label="Scratchpad" value={overview?.scratchpadCount ?? "—"} />
        <MetricCard label="Retrieved Hits" value={results ? retrievedCount : "—"} />
      </div>

      {view === "overview" ? (
        <Card className="zed-glass border-white/10">
          <CardHeader>
            <CardTitle className="text-base">Retrieval Inspector</CardTitle>
            <CardDescription>
              Search live knowledge and inspect what ZED can actually retrieve from foundation, rules, project memory, scratchpad, and semantic recall.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search knowledge context..."
                className="border-white/10 bg-black/30 text-sm"
              />
              <Button onClick={searchKnowledge} disabled={searching}>
                <Search size={14} className="mr-2" />
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>

            {results ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <Card className="border-white/10 bg-black/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Foundation + Rules</CardTitle>
                    </CardHeader>
                    <CardContent className="whitespace-pre-wrap text-sm text-foreground/85">
                      {results.foundation || results.core || "No foundation or ruleset matches were returned."}
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-black/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Retrieved Memory</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(results.retrieved || []).length > 0 ? (
                        results.retrieved!.map((item: any) => (
                          <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-foreground/85">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-cyan-300">{item.source}</div>
                            <div>{item.excerpt}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">No semantic or episodic matches yet.</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="border-white/10 bg-black/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Project Matches</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(results.project || []).length > 0 ? (
                        results.project!.map((item: any) => (
                          <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-foreground/85">
                            <div className="mb-1 font-medium">{item.name}</div>
                            {item.description ? <div className="mb-2 text-xs text-muted-foreground">{item.description}</div> : null}
                            <div>{item.excerpt}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">No project memory matches.</div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-black/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Scratchpad Matches</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(results.scratchpad || []).length > 0 ? (
                        results.scratchpad!.map((item: any) => (
                          <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-foreground/85">
                            {item.tags?.length ? (
                              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-purple-300">{item.tags.join(" • ")}</div>
                            ) : null}
                            <div>{item.excerpt}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">No scratchpad matches.</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {view === "project" ? (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="zed-glass border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus size={16} className="text-emerald-300" />
                Durable Project Memory
              </CardTitle>
              <CardDescription>Store long-lived business, product, and operating knowledge that ZED should retrieve consistently.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <LabeledInput label="Name" value={projectDraft.name} onChange={(value) => setProjectDraft((prev) => ({ ...prev, name: value }))} placeholder="ZWAP launch narrative" />
                <LabeledInput label="Description" value={projectDraft.description} onChange={(value) => setProjectDraft((prev) => ({ ...prev, description: value }))} placeholder="Why this memory matters" />
              </div>
              <label className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Memory Type</div>
                <Select value={projectDraft.type} onValueChange={(value) => setProjectDraft((prev) => ({ ...prev, type: value }))}>
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
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Content</div>
                <Textarea rows={14} value={projectDraft.content} onChange={(e) => setProjectDraft((prev) => ({ ...prev, content: e.target.value }))} className="zed-glass border-white/10 text-sm" placeholder="Write the durable knowledge ZED should retain and retrieve later." />
              </label>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Active Memory</div>
                  <div className="text-xs text-muted-foreground">Inactive entries stay archived but are not prioritized during retrieval.</div>
                </div>
                <Switch checked={projectDraft.isActive} onCheckedChange={(checked) => setProjectDraft((prev) => ({ ...prev, isActive: checked }))} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={saveProjectMemory}>
                  <Save size={14} className="mr-2" />
                  {projectStatus === "saving" ? "Saving..." : projectDraft.id ? "Update Memory" : "Create Memory"}
                </Button>
                {projectDraft.id ? <Button variant="outline" className="border-white/10" onClick={() => setProjectDraft(EMPTY_PROJECT_MEMORY)}>Cancel Edit</Button> : null}
                {projectStatus === "error" ? <span className="text-xs text-red-400">Name and content are required.</span> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="zed-glass border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Stored Project Memory</CardTitle>
              <CardDescription>Review, edit, or remove durable memory entries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {projectMemoryItems.length > 0 ? projectMemoryItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-white/10 bg-black/30 text-[10px] uppercase tracking-[0.14em]">{item.type || "context"}</Badge>
                        <Badge variant="outline" className={item.isActive ? "border-emerald-400/30 text-emerald-300" : "border-white/10 text-muted-foreground"}>{item.isActive ? "Active" : "Inactive"}</Badge>
                      </div>
                      {item.description ? <div className="text-xs leading-5 text-muted-foreground">{item.description}</div> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="border-white/10" onClick={() => setProjectDraft({ id: item.id, name: item.name, description: item.description || "", content: item.content, type: item.type || "context", isActive: item.isActive ?? true })}>
                        <Edit3 size={12} className="mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-500/20 text-red-300 hover:bg-red-500/10" onClick={() => deleteProjectMemory(item.id)}>
                        <Trash2 size={12} className="mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-foreground/85">{item.content}</div>
                </div>
              )) : <div className="text-sm text-muted-foreground">No project memory stored yet.</div>}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {view === "scratchpad" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="zed-glass border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Edit3 size={16} className="text-purple-300" />
                Temporary Working Memory
              </CardTitle>
              <CardDescription>Capture near-term operating context without polluting the permanent knowledge base.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Working Note</div>
                <Textarea rows={12} value={scratchpadDraft.content} onChange={(e) => setScratchpadDraft((prev) => ({ ...prev, content: e.target.value }))} className="zed-glass border-white/10 text-sm" placeholder="Capture active priorities, immediate context, temporary findings, or session-only details." />
              </label>
              <LabeledInput label="Tags" value={scratchpadDraft.tags} onChange={(value) => setScratchpadDraft((prev) => ({ ...prev, tags: value }))} placeholder="launch, zwap, campaign" />
              <div className="flex items-center gap-3">
                <Button onClick={saveScratchpad}>
                  <Save size={14} className="mr-2" />
                  {scratchpadStatus === "saving" ? "Saving..." : "Save Scratchpad"}
                </Button>
                {scratchpadStatus === "error" ? <span className="text-xs text-red-400">Scratchpad content is required.</span> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-muted-foreground">
                Scratchpad memory is for immediate work. It should be trimmed aggressively and only promoted into durable memory when it becomes stable knowledge.
              </div>
            </CardContent>
          </Card>

          <Card className="zed-glass border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Active Scratchpad Entries</CardTitle>
              <CardDescription>Review and clear temporary context that is still influencing retrieval.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {scratchpadItems.length > 0 ? scratchpadItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      {item.tags?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {item.tags.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="border-purple-400/25 text-purple-300">{tag}</Badge>
                          ))}
                        </div>
                      ) : <div className="text-xs text-muted-foreground">Untagged temporary note</div>}
                      {item.expiresAt ? <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Expires {new Date(item.expiresAt).toLocaleString()}</div> : null}
                    </div>
                    <Button size="sm" variant="outline" className="border-red-500/20 text-red-300 hover:bg-red-500/10" onClick={() => deleteScratchpad(item.id)}>
                      <Trash2 size={12} className="mr-1" />
                      Clear
                    </Button>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-foreground/85">{item.content}</div>
                </div>
              )) : <div className="text-sm text-muted-foreground">No scratchpad entries stored yet.</div>}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {view === "core" ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="zed-glass border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BrainCircuit size={16} className="text-cyan-300" />
                Foundation Profile
              </CardTitle>
              <CardDescription>
                Curate the global company-level knowledge ZED should use across brand, products, mission, and strategic direction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Company</div>
                  <Textarea rows={4} value={foundationProfile.company} onChange={(e) => setFoundationProfile((prev) => ({ ...prev, company: e.target.value }))} className="zed-glass border-white/10 text-sm" placeholder="Company identity, structure, and overarching context." />
                </label>
                <label className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Mission</div>
                  <Textarea rows={4} value={foundationProfile.mission} onChange={(e) => setFoundationProfile((prev) => ({ ...prev, mission: e.target.value }))} className="zed-glass border-white/10 text-sm" placeholder="What the organization is trying to accomplish." />
                </label>
                <label className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Products & Ventures</div>
                  <Textarea rows={5} value={foundationProfile.products} onChange={(e) => setFoundationProfile((prev) => ({ ...prev, products: e.target.value }))} className="zed-glass border-white/10 text-sm" placeholder="Products, brands, apps, services, and venture portfolio." />
                </label>
                <label className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Audience</div>
                  <Textarea rows={5} value={foundationProfile.audience} onChange={(e) => setFoundationProfile((prev) => ({ ...prev, audience: e.target.value }))} className="zed-glass border-white/10 text-sm" placeholder="Who the company serves and how users/customers should be understood." />
                </label>
                <label className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Brand Voice</div>
                  <Textarea rows={5} value={foundationProfile.brand} onChange={(e) => setFoundationProfile((prev) => ({ ...prev, brand: e.target.value }))} className="zed-glass border-white/10 text-sm" placeholder="Voice, tone, positioning, and brand personality." />
                </label>
                <label className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Operating Principles</div>
                  <Textarea rows={5} value={foundationProfile.principles} onChange={(e) => setFoundationProfile((prev) => ({ ...prev, principles: e.target.value }))} className="zed-glass border-white/10 text-sm" placeholder="How the organization prefers to operate and make decisions." />
                </label>
              </div>

              <label className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Strategic Priorities</div>
                <Textarea rows={6} value={foundationProfile.priorities} onChange={(e) => setFoundationProfile((prev) => ({ ...prev, priorities: e.target.value }))} className="zed-glass border-white/10 text-sm" placeholder="Near-term priorities, current focus areas, and what ZED should optimize toward." />
              </label>

              <Card className="border-white/10 bg-black/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Foundation Memory Preview</CardTitle>
                  <CardDescription>This is the structured core-memory document ZED will retrieve from the global foundation layer.</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-6 text-foreground/80">
                    {foundationPreview}
                  </pre>
                </CardContent>
              </Card>

              <div className="flex items-center gap-3">
                <Button onClick={saveFoundationProfile}>
                  <Save size={14} className="mr-2" />
                  {foundationStatus === "saving" ? "Saving..." : "Save Foundation Profile"}
                </Button>
                {foundationStatus === "error" ? <span className="text-xs text-red-400">Failed to save the foundation profile.</span> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="zed-glass border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers size={16} className="text-cyan-300" />
                Core Memory Editor
              </CardTitle>
              <CardDescription>Edit canonical system memory entries used across identity, policy, rules, and grounded behavior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LabeledInput label="Key" value={coreDraft.key} onChange={(value) => setCoreDraft((prev) => ({ ...prev, key: value }))} placeholder="identity" />
              <LabeledInput label="Description" value={coreDraft.description} onChange={(value) => setCoreDraft((prev) => ({ ...prev, description: value }))} placeholder="What this core memory entry controls" />
              <label className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Value</div>
                <Textarea rows={16} value={coreDraft.value} onChange={(e) => setCoreDraft((prev) => ({ ...prev, value: e.target.value }))} className="zed-glass border-white/10 font-mono text-xs" placeholder="Store structured JSON, YAML-ish text, or canonical memory text here." />
              </label>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Admin Only</div>
                  <div className="text-xs text-muted-foreground">Restrict this memory entry to privileged administrative access.</div>
                </div>
                <Switch checked={coreDraft.adminOnly} onCheckedChange={(checked) => setCoreDraft((prev) => ({ ...prev, adminOnly: checked }))} />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={saveCoreMemory}>
                  <Save size={14} className="mr-2" />
                  {coreStatus === "saving" ? "Saving..." : "Save Core Memory"}
                </Button>
                <Button variant="outline" className="border-white/10" onClick={() => setCoreDraft(EMPTY_CORE_MEMORY)}>Reset</Button>
                {coreStatus === "error" ? <span className="text-xs text-red-400">Key and value are required.</span> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="zed-glass border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Current Core Memory</CardTitle>
              <CardDescription>Load an existing entry into the editor, then update it without leaving this screen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {coreMemoryItems.length > 0 ? coreMemoryItems.map((item) => (
                <div key={item.id || item.key} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">{item.key}</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-white/10 text-muted-foreground">{item.adminOnly ? "Admin Only" : "Shared"}</Badge>
                        {item.description ? <Badge variant="outline" className="border-white/10 text-muted-foreground">{item.description}</Badge> : null}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="border-white/10" onClick={() => setCoreDraft({ key: item.key, description: item.description || "", value: item.value || "", adminOnly: item.adminOnly ?? true })}>
                      <Edit3 size={12} className="mr-1" />
                      Load
                    </Button>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-6 text-foreground/80">{item.value}</pre>
                </div>
              )) : <div className="text-sm text-muted-foreground">No core memory entries were returned.</div>}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
