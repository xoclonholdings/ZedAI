import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CoreView } from "./knowledge/CoreView";
import { MetricCard, SectionIntro } from "./knowledge/atoms";
import { OverviewView } from "./knowledge/OverviewView";
import { ProjectView } from "./knowledge/ProjectView";
import { ScratchpadView } from "./knowledge/ScratchpadView";
import {
  EMPTY_CORE_MEMORY,
  EMPTY_FOUNDATION_PROFILE,
  EMPTY_PROJECT_MEMORY,
  EMPTY_SCRATCHPAD,
  VIEW_META,
  parseFoundationProfile,
  serializeFoundationProfile,
  type CoreMemoryDraft,
  type FoundationProfile,
  type KnowledgeOverview,
  type KnowledgeView,
  type ProjectMemoryDraft,
  type SaveStatus,
  type ScratchpadDraft,
  type SearchResults,
} from "./knowledge/types";

export default function KnowledgeSection() {
  const [view, setView] = useState<KnowledgeView>("overview");
  const [overview, setOverview] = useState<KnowledgeOverview | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [projectItems, setProjectItems] = useState<any[]>([]);
  const [scratchpadItems, setScratchpadItems] = useState<any[]>([]);
  const [coreItems, setCoreItems] = useState<any[]>([]);
  const [projectDraft, setProjectDraft] = useState<ProjectMemoryDraft>(EMPTY_PROJECT_MEMORY);
  const [scratchpadDraft, setScratchpadDraft] = useState<ScratchpadDraft>(EMPTY_SCRATCHPAD);
  const [coreDraft, setCoreDraft] = useState<CoreMemoryDraft>(EMPTY_CORE_MEMORY);
  const [foundationProfile, setFoundationProfile] =
    useState<FoundationProfile>(EMPTY_FOUNDATION_PROFILE);
  const [projectStatus, setProjectStatus] = useState<SaveStatus>("idle");
  const [scratchpadStatus, setScratchpadStatus] = useState<SaveStatus>("idle");
  const [coreStatus, setCoreStatus] = useState<SaveStatus>("idle");
  const [foundationStatus, setFoundationStatus] = useState<SaveStatus>("idle");

  const retrievedCount = useMemo(() => (results?.retrieved || []).length, [results]);
  const foundationPreview = useMemo(
    () => serializeFoundationProfile(foundationProfile),
    [foundationProfile],
  );
  const currentViewMeta = VIEW_META[view];
  const CurrentViewIcon = currentViewMeta.icon;

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
      if (projectRes.ok) setProjectItems((await projectRes.json()).items || []);
      if (scratchpadRes.ok) setScratchpadItems((await scratchpadRes.json()).items || []);
      if (coreRes.ok) {
        const items = (await coreRes.json()).items || [];
        setCoreItems(items);
        const foundationEntry = items.find((item: any) => item.key === "foundation_profile");
        if (foundationEntry?.value) {
          setFoundationProfile(parseFoundationProfile(String(foundationEntry.value)));
        }
      }
    } catch {
      /* ignore — Refresh button retries; per-view editors show their own errors */
    }
    setRefreshing(false);
  }

  async function searchKnowledge() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query.trim())}`, {
        credentials: "include",
      });
      if (res.ok) setResults(await res.json());
    } catch {
      /* ignore — empty results panel signals failure */
    }
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
        isEditing
          ? `/api/knowledge/project-memory/${projectDraft.id}`
          : "/api/knowledge/project-memory",
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
    } catch {
      /* delete failures show as the row reappearing on refresh */
    }
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
          tags: scratchpadDraft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
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
    } catch {
      /* delete failures show as the row reappearing on refresh */
    }
  }

  async function saveCoreMemory() {
    if (!coreDraft.key.trim() || !coreDraft.value.trim()) {
      setCoreStatus("error");
      return;
    }
    setCoreStatus("saving");
    try {
      const res = await fetch(
        `/api/knowledge/core-memory/${encodeURIComponent(coreDraft.key.trim())}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            description: coreDraft.description,
            value: coreDraft.value,
            adminOnly: coreDraft.adminOnly,
          }),
        },
      );
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
          description:
            "Structured global foundation profile for company, products, mission, audience, and operating principles.",
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
    <div className="space-y-5">
      <SectionIntro
        title="Knowledge"
        description="Use one focused dropdown to inspect retrieval, manage durable memory, clean temporary context, or edit canonical core memory."
        action={
          <Button
            variant="outline"
            className="border-white/10"
            onClick={refreshKnowledgeData}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={`mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="rounded-2xl border border-white/10 bg-black/25 p-3 space-y-3">
        <label className="block space-y-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Knowledge Section
          </span>
          <select
            value={view}
            onChange={(event) => setView(event.target.value as KnowledgeView)}
            className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm font-medium text-foreground outline-none focus:border-cyan-400/50"
          >
            {(Object.keys(VIEW_META) as KnowledgeView[]).map((key) => (
              <option key={key} value={key}>
                {VIEW_META[key].label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="rounded-xl border border-white/10 bg-black/40 p-2">
            <CurrentViewIcon size={15} className="text-cyan-300" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{currentViewMeta.label}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {currentViewMeta.description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Core Memory" value={overview?.coreCount ?? "—"} />
        <MetricCard label="Project Memory" value={overview?.projectCount ?? "—"} />
        <MetricCard label="Scratchpad" value={overview?.scratchpadCount ?? "—"} />
        <MetricCard label="Retrieved Hits" value={results ? retrievedCount : "—"} />
      </div>

      {view === "overview" ? (
        <OverviewView
          query={query}
          setQuery={setQuery}
          searching={searching}
          results={results}
          onSearch={searchKnowledge}
        />
      ) : null}

      {view === "project" ? (
        <ProjectView
          items={projectItems}
          draft={projectDraft}
          setDraft={setProjectDraft}
          status={projectStatus}
          onSave={saveProjectMemory}
          onDelete={deleteProjectMemory}
        />
      ) : null}

      {view === "scratchpad" ? (
        <ScratchpadView
          items={scratchpadItems}
          draft={scratchpadDraft}
          setDraft={setScratchpadDraft}
          status={scratchpadStatus}
          onSave={saveScratchpad}
          onDelete={deleteScratchpad}
        />
      ) : null}

      {view === "core" ? (
        <CoreView
          coreItems={coreItems}
          coreDraft={coreDraft}
          setCoreDraft={setCoreDraft}
          coreStatus={coreStatus}
          onSaveCore={saveCoreMemory}
          foundationProfile={foundationProfile}
          setFoundationProfile={setFoundationProfile}
          foundationStatus={foundationStatus}
          foundationPreview={foundationPreview}
          onSaveFoundation={saveFoundationProfile}
        />
      ) : null}
    </div>
  );
}
