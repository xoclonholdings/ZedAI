import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  BookOpen,
  Briefcase,
  ChevronLeft,
  FolderKanban,
  GraduationCap,
  History,
  Inbox,
  Layers,
  LineChart,
  MessageSquare,
  PenTool,
  Search,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  label: string;
  purpose: string;
  icon: LucideIcon;
  categories: string[];
  empty: string;
  subspaces?: Subspace[];
}

const FINANCE: WorkspaceConfig = {
  label: "Finance",
  purpose:
    "Budget, banking, credit, trading, and investments in one place. Budget Management organizes every deposit; Trading stays separate.",
  icon: Wallet,
  categories: ["finance"],
  empty: "Open Budget Management to allocate deposits, or Trading Intelligence for market work.",
  subspaces: [
    {
      label: "Budget Management",
      description:
        "Allocate every deposit across savings, taxes, personal payroll, and the business treasury — the Dual Reserve Strategy.",
      href: "/budget",
      icon: Wallet,
      accent: "cyan",
    },
    {
      label: "Trading Intelligence",
      description:
        "Theses, journals, paper trades, and performance. Kept separate — treasury never auto-funds trading.",
      href: "/trading",
      icon: LineChart,
      accent: "fuchsia",
    },
  ],
};

const WORKSPACES: Record<string, WorkspaceConfig> = {
  research: {
    label: "Research",
    purpose:
      "Research people, companies, markets, competitors, technologies, products, trends, papers, and documents.",
    icon: Search,
    categories: ["research"],
    empty: "No research tools are published yet.",
  },
  operations: {
    label: "Operations",
    purpose:
      "Plan and run the business — projects, flows, run history, and the tools that keep day-to-day work moving.",
    icon: Briefcase,
    categories: ["business", "operations", "strategy", "planning", "project", "revenue", "sales"],
    empty: "No operations tools are published yet.",
    subspaces: [
      {
        label: "Projects",
        description:
          "File conversations, sources, and instructions per initiative. Each project keeps its own memory so Zed answers in-context.",
        href: "/projects",
        icon: FolderKanban,
        accent: "cyan",
      },
      {
        label: "Flow Library",
        description:
          "Published tools and multi-step flows — the reusable playbooks Zed can run on demand.",
        href: "/flows",
        icon: Wrench,
        accent: "fuchsia",
      },
      {
        label: "Run History",
        description:
          "Every flow Zed has executed, with inputs, outputs, and traces. Audit what happened and rerun what worked.",
        href: "/runs",
        icon: History,
        accent: "emerald",
      },
    ],
  },
  finance: FINANCE,
  // `trading` stays as an alias so old links keep working.
  trading: FINANCE,
  marketing: {
    label: "Marketing",
    purpose:
      "Grow your audience — inbox triage, campaigns, and content flows. Zed pulls emails and messages into one place so you decide, not sort.",
    icon: PenTool,
    categories: ["marketing", "content", "social", "pr"],
    empty: "No marketing flows are published yet.",
    subspaces: [
      {
        label: "Inbox",
        description:
          "Zed reads incoming email, classifies urgency, and surfaces what actually needs your reply.",
        href: "/inbox",
        icon: Inbox,
        accent: "cyan",
      },
      {
        label: "Content Flows",
        description:
          "Published content playbooks — briefs, drafts, SEO passes, distribution. Runs live in Run History.",
        href: "/flows",
        icon: Layers,
        accent: "fuchsia",
      },
    ],
  },
  education: {
    label: "Education",
    purpose:
      "Learn new skills. Zed builds paths, practices, assessments, and remembers what you've taught it.",
    icon: GraduationCap,
    categories: ["learning", "personal_development"],
    empty: "No learning flows are published yet.",
    subspaces: [
      {
        label: "Knowledge Library",
        description:
          "Everything Zed remembers about you and your work. Add notes or upload files; Zed structures it into objects it can recall.",
        href: "/learning",
        icon: BookOpen,
        accent: "cyan",
      },
    ],
  },
};

export default function WorkspacePage() {
  const [, navigate] = useLocation();
  const { workspace = "research" } = useParams<{ workspace?: string }>();
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe-sm zed-glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/home")}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Home
        </Button>
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-cyan-300" />
          <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            {config.label}
          </span>
        </div>
        <span className="w-14" />
      </div>

      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
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
          className="w-full rounded-xl zed-gradient"
        >
          <MessageSquare size={14} className="mr-2" />
          Ask Zed in {config.label}
        </Button>

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
                    className="rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition-all hover:border-cyan-400/40 hover:bg-white/5 active:scale-[0.99]"
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
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
              {config.empty}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {workspaceItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/workspaces/${workspace}/tools/${item.id}`)}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition-all hover:border-cyan-400/40 hover:bg-white/5 active:scale-[0.99]"
                >
                  <div className="text-sm font-semibold text-foreground">{item.userFacingLabel}</div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.userFacingBlurb}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.16em]">
                      {item.stageCount} step set{item.stageCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
