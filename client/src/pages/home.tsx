import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Briefcase,
  CalendarClock,
  CheckSquare,
  Copy,
  FileText,
  FolderKanban,
  Gavel,
  GraduationCap,
  HelpCircle,
  LineChart,
  MessageSquare,
  PenTool,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  ShieldAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth/UseAuth";
import {
  readWorkspaceFromStorage,
  WORKSPACE_LABEL,
  type WorkspaceSlug,
} from "@/lib/workspaceContext";
import {
  TRADING_STAGES,
  type TradingProgression,
} from "@shared/trading-progression";
import type {
  AnyMemoryObject,
  ObjectGraph,
  ObjectMemoryType,
} from "@shared/object-memory-types";

/**
 * Zed's operational home — the Knowledge Map.
 *
 * Home leads with what Zed knows (objects), what needs attention
 * (discovery), and how to move (workspaces). Domain snapshots
 * (Trading progression, Budget) live below as "Current work" — they
 * remain but stop dominating. The full trading stage screen and
 * runtime activity feed live on their own routes.
 */

interface ApprovalEntry {
  id: string;
  status: "pending" | "approved" | "rejected";
}

interface ProjectSummary {
  id: string;
  name: string;
  updatedAt?: string;
  createdAt?: string;
  conversationIds?: string[];
}

interface BudgetSummary {
  totals?: { reserves?: number; ytdIncome?: number; lastDepositAt?: string | null };
  treasury?: { balance?: number; milestone?: { label?: string } };
  pendingAllocation?: number;
}

const WORKSPACE_LAUNCHERS: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
}> = [
  { label: "Research", href: "/workspaces/research", icon: Search, hint: "Dig in" },
  { label: "Operations", href: "/workspaces/operations", icon: Briefcase, hint: "Run it" },
  { label: "Finance", href: "/workspaces/finance", icon: Wallet, hint: "Money & trades" },
  { label: "Marketing", href: "/workspaces/marketing", icon: PenTool, hint: "Reach out" },
  { label: "Education", href: "/workspaces/education", icon: GraduationCap, hint: "Learn" },
];

interface KnowledgeTile {
  label: string;
  href: string;
  icon: LucideIcon;
  types: ObjectMemoryType[];
}

const KNOWLEDGE_TILES: KnowledgeTile[] = [
  { label: "Decisions", href: "/decisions", icon: Gavel, types: ["decision"] },
  { label: "Projects", href: "/projects", icon: FolderKanban, types: ["project"] },
  { label: "Tasks", href: "/learning?type=task", icon: CheckSquare, types: ["task"] },
  {
    label: "Rules",
    href: "/learning?type=rule",
    icon: ScrollText,
    types: ["rule", "constraint", "preference"],
  },
  { label: "Sources", href: "/learning", icon: FileText, types: [] },
  { label: "Events", href: "/learning?type=event", icon: CalendarClock, types: ["event"] },
];

function friendlyTime(t: string): string {
  try {
    const d = new Date(t);
    const now = new Date();
    const min = Math.round((now.getTime() - d.getTime()) / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return d.toLocaleDateString();
  } catch {
    return t;
  }
}

function money(v?: number): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

const LOW_CONFIDENCE = 0.5;

export default function HomePage() {
  const { user } = useAuth() as { user?: any };
  const [, navigate] = useLocation();
  const isAdmin = !!user?.isAdmin || !!user?.claims?.isAdmin;

  const [progression, setProgression] = useState<TradingProgression | null>(null);
  const [approvalsCount, setApprovalsCount] = useState<number>(0);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [memory, setMemory] = useState<ObjectGraph | null>(null);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSlug | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setActiveWorkspace(readWorkspaceFromStorage());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const getJson = (url: string) =>
      fetch(url, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    const [progRes, projectsRes, memoryRes, budgetRes, approvalsRes] = await Promise.all([
      getJson("/api/trading/progression"),
      getJson("/api/projects"),
      getJson("/api/me/memory/graph"),
      getJson("/api/budget"),
      isAdmin ? getJson("/api/admin/approval-queue") : Promise.resolve(null),
    ]);

    setProgression(progRes?.progression || null);
    const projectList: ProjectSummary[] = Array.isArray(projectsRes?.projects)
      ? projectsRes.projects
      : [];
    projectList.sort((a, b) => {
      const at = a.updatedAt || a.createdAt || "";
      const bt = b.updatedAt || b.createdAt || "";
      return at < bt ? 1 : -1;
    });
    setProjects(projectList);
    setMemory(memoryRes || null);
    setBudget(budgetRes || null);
    setApprovalsCount(
      Array.isArray(approvalsRes?.entries)
        ? approvalsRes.entries.filter((e: ApprovalEntry) => e.status === "pending").length
        : 0,
    );
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentStageDef = useMemo(() => {
    if (!progression) return null;
    return TRADING_STAGES.find((s) => s.id === progression.currentStage) || null;
  }, [progression]);

  const displayName =
    user?.displayName ||
    user?.personalization?.displayName ||
    user?.username ||
    "there";

  const objects: AnyMemoryObject[] = useMemo(() => memory?.objects || [], [memory]);
  const countsByType = useMemo(() => {
    const map: Partial<Record<ObjectMemoryType, number>> = {};
    for (const o of objects) map[o.type] = (map[o.type] || 0) + 1;
    return map;
  }, [objects]);
  const knowledgeTilesResolved = useMemo(
    () =>
      KNOWLEDGE_TILES.map((tile) => {
        if (tile.label === "Sources") {
          return { ...tile, count: memory?.sources?.length || 0 };
        }
        let count = 0;
        for (const t of tile.types) count += countsByType[t] || 0;
        return { ...tile, count };
      }),
    [countsByType, memory],
  );

  const conflictsCount = useMemo(
    () => objects.filter((o) => o.type === "memory_conflict").length,
    [objects],
  );
  const openQuestionsCount = useMemo(
    () => objects.filter((o) => o.type === "open_question").length,
    [objects],
  );
  const lowConfidenceCount = useMemo(
    () => objects.filter((o) => (o.confidence ?? 1) < LOW_CONFIDENCE).length,
    [objects],
  );
  const duplicateSuspects = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const o of objects) {
      const key = `${o.type}::${(o.canonicalName || "").toLowerCase().trim()}`;
      if (!key.endsWith("::")) grouped[key] = (grouped[key] || 0) + 1;
    }
    return Object.values(grouped).filter((n) => n > 1).length;
  }, [objects]);

  const discoveryItems = useMemo(
    () =>
      [
        {
          key: "conflicts",
          label: "Conflicts to resolve",
          count: conflictsCount,
          icon: AlertTriangle,
          accent: "amber" as const,
          href: "/discovery?filter=conflicts",
        },
        {
          key: "questions",
          label: "Open questions",
          count: openQuestionsCount,
          icon: HelpCircle,
          accent: "cyan" as const,
          href: "/discovery?filter=open-questions",
        },
        {
          key: "lowConfidence",
          label: "Low-confidence facts",
          count: lowConfidenceCount,
          icon: ShieldAlert,
          accent: "fuchsia" as const,
          href: "/discovery?filter=low-confidence",
        },
        {
          key: "duplicates",
          label: "Possible duplicates",
          count: duplicateSuspects,
          icon: Copy,
          accent: "emerald" as const,
          href: "/discovery?filter=duplicates",
        },
      ].filter((d) => d.count > 0),
    [conflictsCount, openQuestionsCount, lowConfidenceCount, duplicateSuspects],
  );

  const treasuryBalance = budget?.treasury?.balance ?? 0;
  const treasuryLabel = budget?.treasury?.milestone?.label;
  const pendingAllocation = budget?.pendingAllocation ?? 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 zed-glass px-4 pb-3 pt-safe-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Home</div>
            <div className="text-[15.5px] font-semibold tracking-[-0.01em] text-white truncate">
              Hi, {displayName}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/chat")}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white transition-colors"
            >
              <MessageSquare size={12} />
              Chat
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              <span className="sr-only sm:not-sr-only">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Approvals banner */}
        {isAdmin && approvalsCount > 0 && (
          <section className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 flex items-start gap-3">
            <Bell size={16} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium text-amber-100">
                {approvalsCount} approval{approvalsCount === 1 ? "" : "s"} waiting for you
              </div>
              <div className="text-[12px] text-amber-100/70 mt-0.5">
                Zed's paused these actions until you approve or reject.
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="shrink-0 rounded-lg bg-amber-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-amber-300 transition-colors"
            >
              Review
            </button>
          </section>
        )}

        {/* Active workspace banner */}
        {activeWorkspace && (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/[0.05] px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-cyan-200/80">
                In workspace
              </div>
              <div className="text-[14px] font-medium text-white leading-tight">
                {WORKSPACE_LABEL[activeWorkspace]}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/chat?ctx=${activeWorkspace}`)}
              className="shrink-0 rounded-lg border border-cyan-400/40 bg-cyan-400/[0.1] text-cyan-100 hover:bg-cyan-400/[0.18] px-3 py-1.5 text-[12px]"
            >
              Continue
            </button>
          </section>
        )}

        {/* Quick actions */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <QuickAction icon={MessageSquare} label="Ask Zed" onClick={() => navigate("/chat")} />
          <QuickAction icon={Plus} label="Add to memory" onClick={() => navigate("/learning")} />
          {isAdmin ? (
            <QuickAction
              icon={ShieldAlert}
              label={approvalsCount > 0 ? `${approvalsCount} pending` : "Approvals"}
              onClick={() => navigate("/admin")}
              emphasis={approvalsCount > 0}
            />
          ) : (
            <QuickAction icon={FolderKanban} label="Projects" onClick={() => navigate("/projects")} />
          )}
        </section>

        {/* Discovery Feed */}
        {discoveryItems.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
                Discovery feed
              </div>
              <span className="text-[11px] text-white/40">Signals worth reviewing</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {discoveryItems.map((d) => (
                <DiscoveryCard
                  key={d.key}
                  icon={d.icon}
                  label={d.label}
                  count={d.count}
                  accent={d.accent}
                  onClick={() => navigate(d.href)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Knowledge Map */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
              Knowledge map
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/timeline")}
                className="text-[12px] text-white/60 hover:text-white/85"
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => navigate("/learning")}
                className="text-[12px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
              >
                Open library <ArrowRight size={11} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {knowledgeTilesResolved.map((tile) => {
              const TIcon = tile.icon;
              return (
                <button
                  key={tile.label}
                  type="button"
                  onClick={() => navigate(tile.href)}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left hover:bg-white/[0.05] hover:border-white/20 transition-colors active:opacity-80"
                >
                  <TIcon size={15} className="text-cyan-300/80 mb-1.5" />
                  <div className="flex items-baseline gap-2">
                    <div className="text-[16.5px] font-semibold text-white tabular-nums">
                      {tile.count}
                    </div>
                    <div className="text-[12px] text-white/60">{tile.label.toLowerCase()}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Workspaces launcher */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
              Workspaces
            </div>
            <span className="text-[11px] text-white/40">Jump anywhere</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {WORKSPACE_LAUNCHERS.map((w) => {
              const WIcon = w.icon;
              return (
                <button
                  key={w.href}
                  type="button"
                  onClick={() => navigate(w.href)}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left hover:bg-white/[0.05] hover:border-white/20 transition-colors active:opacity-80"
                >
                  <WIcon size={15} className="text-cyan-300/80 mb-1.5" />
                  <div className="text-[13px] font-medium text-white truncate">{w.label}</div>
                  <div className="text-[11px] text-white/40 truncate">{w.hint}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Recent projects */}
        {projects.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
                Recent projects
              </div>
              <button
                type="button"
                onClick={() => navigate("/projects")}
                className="text-[12px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
              >
                All projects <ArrowRight size={11} />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {projects.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left hover:bg-white/[0.05] hover:border-white/20 transition-colors active:opacity-80"
                >
                  <div className="flex items-center gap-2">
                    <FolderKanban size={13} className="text-cyan-300/80 shrink-0" />
                    <span className="text-[13px] font-medium text-white truncate">
                      {p.name || "Untitled"}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-white/40">
                    {p.updatedAt ? friendlyTime(p.updatedAt) : "New"}
                    {p.conversationIds && p.conversationIds.length > 0
                      ? ` · ${p.conversationIds.length} chat${p.conversationIds.length === 1 ? "" : "s"}`
                      : ""}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Current work — compact domain signals; details live on their pages */}
        {(currentStageDef || budget) && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50 mb-3">
              Current work
            </div>
            <div className="space-y-2">
              {currentStageDef && (
                <CurrentWorkRow
                  icon={LineChart}
                  eyebrow={`Trading · stage ${currentStageDef.order}/${TRADING_STAGES.length}`}
                  title={currentStageDef.label}
                  detail={currentStageDef.purpose}
                  href="/trading"
                />
              )}
              {budget && (
                <CurrentWorkRow
                  icon={Wallet}
                  eyebrow="Finance · treasury"
                  title={`${money(treasuryBalance)} · ${treasuryLabel || (treasuryBalance > 0 ? "Building" : "Not started")}`}
                  detail={
                    pendingAllocation
                      ? `${money(pendingAllocation)} waiting to allocate`
                      : "No pending allocation"
                  }
                  href="/budget"
                />
              )}
            </div>
          </section>
        )}

        <div className="pt-2 text-center text-[11.5px] text-white/30">
          <BookOpen size={11} className="inline mr-1 opacity-60" />
          Memory, settings, and workspace context persist across visits.
        </div>
      </main>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  emphasis,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left transition-colors active:opacity-80 ${
        emphasis
          ? "border-amber-400/40 bg-amber-400/[0.08] hover:bg-amber-400/[0.12]"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      <Icon
        size={16}
        className={`mb-2 ${emphasis ? "text-amber-300" : "text-cyan-300/80"}`}
      />
      <div className="text-[13.5px] font-medium text-white">{label}</div>
    </button>
  );
}

function DiscoveryCard({
  icon: Icon,
  label,
  count,
  accent,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  accent: "amber" | "cyan" | "fuchsia" | "emerald";
  onClick: () => void;
}) {
  const map = {
    amber: "border-amber-400/25 bg-amber-400/[0.05] text-amber-200",
    cyan: "border-cyan-400/25 bg-cyan-400/[0.05] text-cyan-200",
    fuchsia: "border-fuchsia-400/25 bg-fuchsia-400/[0.05] text-fuchsia-200",
    emerald: "border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-200",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-colors active:opacity-80 hover:bg-white/[0.05] ${map[accent]}`}
    >
      <Icon size={14} className="mb-1.5" />
      <div className="text-[16.5px] font-semibold tabular-nums text-white">{count}</div>
      <div className="text-[11.5px] text-white/70">{label}</div>
    </button>
  );
}

function CurrentWorkRow({
  icon: Icon,
  eyebrow,
  title,
  detail,
  href,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
}) {
  const [, navigate] = useLocation();
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left hover:bg-white/[0.05] hover:border-white/20 transition-colors active:opacity-80"
    >
      <div className="shrink-0 w-8 h-8 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 flex items-center justify-center">
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.08em] text-white/40">{eyebrow}</div>
        <div className="text-[13.5px] font-medium text-white truncate">{title}</div>
        <div className="text-[11.5px] text-white/50 truncate">{detail}</div>
      </div>
      <ArrowRight size={13} className="text-white/40 shrink-0" />
    </button>
  );
}
