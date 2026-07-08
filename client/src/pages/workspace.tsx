import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  Briefcase,
  ChevronLeft,
  GraduationCap,
  LineChart,
  PenTool,
  Search,
  Wallet,
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

const WORKSPACES: Record<
  string,
  {
    label: string;
    purpose: string;
    icon: LucideIcon;
    categories: string[];
    empty: string;
  }
> = {
  research: {
    label: "Research",
    purpose: "Research people, companies, markets, competitors, technologies, products, trends, papers, and documents.",
    icon: Search,
    categories: ["research"],
    empty: "No research tools are published yet.",
  },
  business: {
    label: "Business",
    purpose: "Build and operate businesses with strategy, product, marketing, finance, operations, and reporting tools.",
    icon: Briefcase,
    categories: ["business", "revenue", "strategy", "planning", "operations", "marketing", "sales", "project"],
    empty: "No business tools are published yet.",
  },
  content: {
    label: "Content",
    purpose: "Plan, create, optimize, and publish content across scripts, SEO, YouTube, social, analytics, and reports.",
    icon: PenTool,
    categories: ["content", "social", "marketing", "pr"],
    empty: "No content tools are published yet.",
  },
  learning: {
    label: "Learning",
    purpose: "Build skills through paths, practice, assessments, knowledge checks, and progress reviews.",
    icon: GraduationCap,
    categories: ["learning", "personal_development"],
    empty: "No learning tools are published yet.",
  },
  trading: {
    label: "Trading",
    purpose: "Research, validate, journal, and improve trading decisions. Phase 1 is paper trading only.",
    icon: LineChart,
    categories: ["finance"],
    empty: "Open Trading Intelligence for theses, journals, paper trades, and performance.",
  },
  finance: {
    label: "Finance",
    purpose: "Budget, banking, credit, trading, and investments in one place. Budget Management organizes every deposit; Trading stays separate.",
    icon: Wallet,
    categories: ["finance"],
    empty: "Open Budget Management to allocate deposits, or Trading Intelligence for market work.",
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
          onClick={() => navigate("/chat")}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Chat
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

        {workspace === "trading" && (
          <Button onClick={() => navigate("/trading")} className="w-full rounded-xl zed-gradient">
            Open Trading Intelligence
          </Button>
        )}

        {workspace === "finance" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate("/budget")}
              className="rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition-all hover:border-cyan-400/40 hover:bg-white/5 active:scale-[0.99]"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wallet size={15} className="text-cyan-300" />
                Budget Management
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Allocate every deposit across savings, taxes, personal payroll, and the business treasury — the Dual
                Reserve Strategy.
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate("/trading")}
              className="rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition-all hover:border-cyan-400/40 hover:bg-white/5 active:scale-[0.99]"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <LineChart size={15} className="text-fuchsia-300" />
                Trading Intelligence
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Theses, journals, paper trades, and performance. Kept separate — treasury never auto-funds trading.
              </p>
            </button>
          </div>
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
