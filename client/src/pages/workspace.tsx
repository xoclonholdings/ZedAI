import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  Briefcase,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Search,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ResearchDesk from "./ResearchDesk";
import WorkspaceDesk from "./WorkspaceDesk";
import WorkspaceLibrary from "@/components/WorkspaceLibrary";
import { WORKSPACE_DESK_SPECS } from "@shared/workspace-desk-types";

interface PublishedWorkItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  userFacingLabel: string;
  userFacingBlurb: string;
  icon?: string;
  stageCount: number;
  agents: string[];
}

interface Subspace {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent?: "cyan" | "fuchsia" | "emerald" | "amber";
}

interface WorkspaceConfig {
  /** The real slug this config lives under — memory tagging and desk
   * lookups always use this, never the URL param, so an alias (e.g.
   * "marketing" -> OPERATIONS) can't fragment memory into a second scope. */
  canonicalSlug: string;
  label: string;
  purpose: string;
  icon: LucideIcon;
  categories: string[];
  empty: string;
  subspaces?: Subspace[];
}

const CAPITAL: WorkspaceConfig = {
  canonicalSlug: "finance",
  label: "ZILLION Prosper",
  purpose:
    "Open the Capital Desk for budgeting, investing research, market intelligence, and governed trading.",
  icon: Wallet,
  categories: [],
  empty: "Capital is owned by ZILLION Prosper.",
};

/**
 * Operations absorbs Marketing's flows (content, social, PR) rather than
 * keeping Marketing as a peer workspace — Marketing had no domain memory
 * of its own, just flows that run inside the business. `marketing` stays
 * as a routing alias below so old links keep working.
 *
 * No subspaces here on purpose: Projects (/projects), Flow Library and
 * Run History (/flows, /runs) are already owned by the Projects and Tools
 * hubs — listing them again here was duplicate parentage, the exact thing
 * this pass removes. What's actually unique to Operations is the desk
 * (see WORKSPACE_DESK_SPECS.operations) — with no subspaces defined, the
 * routing below falls through to it.
 */
const OPERATIONS: WorkspaceConfig = {
  canonicalSlug: "operations",
  label: "Operations",
  purpose:
    "Plan and run the business — objectives, campaigns, and the tools that keep day-to-day work moving.",
  icon: Briefcase,
  categories: [
    "business",
    "operations",
    "strategy",
    "planning",
    "project",
    "revenue",
    "sales",
    "marketing",
    "content",
    "social",
    "pr",
  ],
  empty: "No operations or marketing tools are published yet.",
};

const WORKSPACES: Record<string, WorkspaceConfig> = {
  research: {
    // Research renders the ResearchDesk working surface (see WorkspacePage);
    // this config stays only as a fallback.
    canonicalSlug: "research",
    label: "Research",
    purpose:
      "Research people, companies, markets, competitors, technologies, products, trends, papers, and documents.",
    icon: Search,
    categories: ["research"],
    empty: "No research tools are published yet.",
  },
  operations: OPERATIONS,
  // `marketing` stays as an alias so old links keep working — see note above.
  marketing: OPERATIONS,
  finance: CAPITAL,
  // `trading` stays as an alias so old links keep working.
  trading: CAPITAL,
  education: {
    canonicalSlug: "education",
    label: "Education",
    purpose:
      "Learn new skills. ZAR builds paths, practices, assessments, and remembers what you've taught it.",
    icon: GraduationCap,
    categories: ["learning", "personal_development"],
    empty: "No learning flows are published yet.",
    // No subspaces on purpose: the knowledge library (/learning) and
    // Learning Studio (/learning/studio) are already owned by the Memory
    // hub, not this workspace — duplicate parentage, removed here. What's
    // unique to Education is the study desk (WORKSPACE_DESK_SPECS.education);
    // with no subspaces defined, the routing below falls through to it.
  },
};

const WORKSPACE_INDEX_ORDER = ["research", "operations", "finance", "education"] as const;

/**
 * The bare /workspace route (no :workspace param) - lists every real
 * workspace instead of silently defaulting into Research. This is what the
 * Nexys "Workspaces" domain's real action route (/workspace) resolves to.
 */
function WorkspaceIndex() {
  const [, navigate] = useLocation();

  return (
    <main className="mx-auto max-w-2xl space-y-3">
      <p className="px-1 text-sm leading-6 text-muted-foreground">
        Domain operating spaces ZAR works within. Pick one to open its desk.
      </p>
      <button
        type="button"
        onClick={() => navigate("/knowledge-map")}
        className="zar-glass flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-all hover:shadow-[0_0_24px_rgba(16,185,129,0.25)]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]">
          <LayoutDashboard size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white">Full Dashboard</div>
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
            Discovery feed, projects, knowledge, and approvals in one view.
          </p>
        </div>
      </button>
      {WORKSPACE_INDEX_ORDER.map((slug) => {
        const config = WORKSPACES[slug];
        const Icon = config.icon;
        return (
          <button
            key={slug}
            type="button"
            onClick={() => navigate(`/workspaces/${slug}`)}
            className="zar-glass flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-all hover:shadow-[0_0_24px_rgba(139,0,255,0.3)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.35)]">
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">{config.label}</div>
              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{config.purpose}</p>
            </div>
          </button>
        );
      })}
    </main>
  );
}

export default function WorkspacePage() {
  const [, navigate] = useLocation();
  const { workspace } = useParams<{ workspace?: string }>();

  if (!workspace) return <WorkspaceIndex />;

  return <WorkspaceDetail workspace={workspace} navigate={navigate} />;
}

function WorkspaceDetail({
  workspace,
  navigate,
}: {
  readonly workspace: string;
  readonly navigate: (path: string) => void;
}) {
  const config = WORKSPACES[workspace] || WORKSPACES.research;
  const Icon = config.icon;
  const [items, setItems] = useState<PublishedWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/flows", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setItems(data.flows || []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load workspace");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const workspaceItems = useMemo(() => {
    return items.filter((item) => config.categories.includes(item.category));
  }, [config.categories, items]);

  // Each workspace's real subspaces (Projects/Flows/Runs for Operations,
  // Budget/Trading for Finance, etc.) are domain-specific working surfaces —
  // they take priority over the generic subject-in/entry-out desk below.
  // The desk is only a fallback for a workspace with no subspaces of its own.
  // Placed after all hooks so hook order stays stable.
  if (config.canonicalSlug === "research") {
    return <ResearchDesk />;
  }
  if (!config.subspaces?.length && WORKSPACE_DESK_SPECS[config.canonicalSlug]) {
    return <WorkspaceDesk workspace={config.canonicalSlug} />;
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5 backdrop-blur-md shadow-[0_0_40px_rgba(139,0,255,0.15)]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
          <Icon size={14} />
          Workspace
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{config.label}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{config.purpose}</p>
      </section>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}

      <Button
        onClick={() => navigate(`/chat?ctx=${workspace}`)}
        className="w-full rounded-xl zar-gradient"
      >
        <MessageSquare size={14} className="mr-2" />
        Ask ZAR in {config.label}
      </Button>

      <WorkspaceLibrary workspace={config.canonicalSlug} label={`${config.label} library`} />

      {config.subspaces && config.subspaces.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Subspaces
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.subspaces.map((sub) => {
              const SubIcon = sub.icon;
              const accentText =
                sub.accent === "fuchsia"
                  ? "text-fuchsia-300"
                  : sub.accent === "emerald"
                    ? "text-emerald-300"
                    : sub.accent === "amber"
                      ? "text-amber-300"
                      : "text-cyan-300";
              return (
                <button
                  key={sub.href}
                  type="button"
                  onClick={() => navigate(sub.href)}
                  className="zar-glass rounded-2xl p-4 text-left transition-all hover:shadow-[0_0_22px_rgba(103,232,249,0.25)] active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <SubIcon size={15} className={accentText} />
                    {sub.label}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {sub.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Available Tools</div>
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : workspaceItems.length === 0 ? (
          <div className="zar-glass rounded-2xl p-4 text-sm text-muted-foreground">
            {config.empty}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {workspaceItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/workspaces/${workspace}/tools/${item.id}`)}
                className="zar-glass rounded-2xl p-4 text-left transition-all hover:shadow-[0_0_22px_rgba(103,232,249,0.25)] active:scale-[0.99]"
              >
                <div className="text-sm font-semibold text-foreground">{item.userFacingLabel}</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.userFacingBlurb}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="zar-glass border-white/10 text-[9px] uppercase tracking-[0.16em]">
                    {item.stageCount} step set{item.stageCount === 1 ? "" : "s"}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
