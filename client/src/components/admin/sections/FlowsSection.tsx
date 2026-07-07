import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import type { FlowDefinition } from "../../../../../shared/flow-types";
import { FlowDetail } from "./flows/FlowDetail";
import type { View } from "./flows/shared";

import {
  SaveIndicator,
  Segmented,
  SettingGroup,
  SettingRow,
} from "./settings/atoms";

/**
 * Plain-language Tools tab.
 *
 * "Tool" here means: a reusable action Zed knows how to run — send
 * a specific weekly report, log a paper trade with a preset thesis,
 * draft a follow-up email in your voice, etc. Each tool has a
 * name, a plain description of what it does, a status (draft /
 * published / archived), and an underlying flow definition you can
 * open and edit.
 *
 * The list uses the same row style as the rest of Settings so
 * the surface feels consistent. Tap any tool to open the detail
 * editor. Tap "New tool" to create one; a name is enough to start.
 */

type ToolFilter = "all" | "published" | "draft" | "archived";
type SaveStatus = "idle" | "saving" | "saved" | "error";

const FILTER_OPTIONS: Array<{ value: ToolFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

function friendlyStatus(status: string): string {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

function friendlyCategory(category?: string): string {
  if (!category) return "";
  const map: Record<string, string> = {
    custom: "Custom",
    research: "Research",
    finance: "Finance",
    business: "Business",
    content: "Content",
    social: "Social",
    learning: "Learning",
    operations: "Operations",
  };
  return map[category] || category.replace(/[._]/g, " ");
}

export default function ToolsSection() {
  const [view, setView] = useState<View>("list");
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [active, setActive] = useState<FlowDefinition | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<ToolFilter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMessage(undefined);
    try {
      const res = await fetch("/api/admin/flows?includeArchived=true", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (err: any) {
      setErrorMessage(err?.message);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createNew = useCallback(async () => {
    const name = window.prompt("Name this tool");
    if (!name?.trim()) return;
    setStatus("saving");
    setErrorMessage(undefined);
    try {
      const res = await fetch("/api/admin/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          slug: undefined,
          category: "custom",
          description: "",
          purpose: "",
          status: "draft",
          version: 1,
          agents: ["operations"],
          triggerConditions: ["manual"],
          stages: [],
          userFacingLabel: name.trim(),
          userFacingBlurb: "",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Create failed (${res.status})`);
      }
      const flow = (await res.json()) as FlowDefinition;
      setActive(flow);
      setView("detail");
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1500);
      void refresh();
    } catch (err: any) {
      setErrorMessage(err?.message);
      setStatus("error");
    }
  }, [refresh]);

  const action = useCallback(
    async (id: string, op: "publish" | "archive" | "duplicate"): Promise<FlowDefinition | null> => {
      const res = await fetch(`/api/admin/flows/${id}/${op}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      return (await res.json()) as FlowDefinition;
    },
    [],
  );

  const counts = useMemo(
    () => ({
      all: flows.length,
      published: flows.filter((f) => f.status === "published").length,
      draft: flows.filter((f) => f.status !== "published" && f.status !== "archived").length,
      archived: flows.filter((f) => f.status === "archived").length,
    }),
    [flows],
  );

  const visible = useMemo(() => {
    if (filter === "published") return flows.filter((f) => f.status === "published");
    if (filter === "archived") return flows.filter((f) => f.status === "archived");
    if (filter === "draft")
      return flows.filter((f) => f.status !== "published" && f.status !== "archived");
    return flows;
  }, [flows, filter]);

  if (view === "detail" && active) {
    return (
      <FlowDetail
        flow={active}
        onBack={() => {
          setView("list");
          void refresh();
        }}
        onSaved={(f) => setActive(f)}
        onAction={async (op) => {
          const next = await action(active.id, op);
          if (next) setActive(next);
        }}
      />
    );
  }

  return (
    <div className="min-w-0">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Tools Zed can run
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            A tool is a reusable action Zed knows how to run — send a specific
            report, log a paper trade with a preset thesis, draft a follow-up
            in your voice. Create one once, then Zed can use it across chats.
            Tap any tool to open it. Tap New tool to create one.
          </p>
        </div>
        <SaveIndicator status={status} errorMessage={errorMessage} />
      </header>

      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <Segmented<ToolFilter>
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter tools"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void createNew()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors active:opacity-80"
          >
            <Plus size={13} />
            New tool
          </button>
        </div>
      </div>

      <div className="mb-4 text-[12.5px] text-white/40">
        {counts.published} published · {counts.draft} draft · {counts.archived} archived
      </div>

      {loading && flows.length === 0 ? (
        <div className="text-center text-[13.5px] text-white/50 py-12">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-[13.5px] text-white/45">
          {filter === "all"
            ? "No tools yet. Tap New tool to create one."
            : `No ${filter} tools.`}
        </div>
      ) : (
        <SettingGroup title={FILTER_OPTIONS.find((f) => f.value === filter)?.label || "Tools"}>
          {visible.map((flow) => {
            const category = friendlyCategory(flow.category);
            const desc = flow.userFacingBlurb || flow.description || flow.purpose || "";
            const description = [
              friendlyStatus(flow.status),
              category,
              desc,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <SettingRow key={flow.id} label={flow.userFacingLabel || flow.name} description={description}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(flow);
                    setView("detail");
                  }}
                  className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/80 hover:text-white hover:border-cyan-400/40 transition-colors active:opacity-80"
                >
                  Open
                </button>
              </SettingRow>
            );
          })}
        </SettingGroup>
      )}
    </div>
  );
}
