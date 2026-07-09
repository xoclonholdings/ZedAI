import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Briefcase,
  Compass,
  FolderKanban,
  GraduationCap,
  Inbox as InboxIcon,
  Layers,
  LineChart,
  MessageSquare,
  PenTool,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  TrendingUp,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth/UseAuth";
import {
  TRADING_STAGES,
  type TradingProgression,
  type TradingStageId,
} from "@shared/trading-progression";
import type { PaperTrade, TradingPerformanceReport } from "@shared/trading-types";
import type { BaseObject, ObjectGraph } from "@shared/object-memory-types";

/**
 * Zed's operational home.
 *
 * A calm read-only landing that answers three questions the moment
 * you sign in:
 *   1. Where am I? (current trading stage + open positions)
 *   2. What's waiting for me? (pending approvals)
 *   3. What's Zed been doing? (recent runtime activity, admin only)
 *
 * Everything reads from existing endpoints. No new data. Every card
 * is a one-tap jump into the surface that owns that state.
 *
 * Stage 1 of the UI Evolution plan (docs/ZED_KNOWLEDGE_UI_EVOLUTION.md).
 * Route is /home — not yet the default landing to preserve /chat as
 * the current entry point until the user opts in.
 */

interface ApprovalEntry {
  id: string;
  status: "pending" | "approved" | "rejected";
}

interface RuntimeEvent {
  timestamp: string;
  level: "info" | "warn" | "error";
  event: string;
  detail?: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  updatedAt?: string;
  createdAt?: string;
  conversationIds?: string[];
}

interface BudgetSummary {
  totals?: {
    reserves?: number;
    ytdIncome?: number;
    lastDepositAt?: string | null;
  };
  treasury?: {
    balance?: number;
    milestone?: { label?: string };
  };
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

const EVENT_LABEL: Record<string, string> = {
  "chat.execution.trace": "Chat request completed",
  "chat.execution.failed": "Chat request failed",
  "self_repair.outcome": "Zed auto-recovered from a failure",
  "approval.queued": "New approval waiting",
  "approval.approved": "You approved something",
  "approval.rejected": "You rejected something",
  "integration.email.test": "Email test sent",
  "policy.external_api.consulted": "Zed checked policy before calling out",
  "policy.external_api.denied": "Policy blocked an outbound call",
  "subsystem.scheduler.tick": "Scheduler ran",
  "trace.validation.violation": "Trace was incomplete",
};

function friendlyEvent(e: string): string {
  return EVENT_LABEL[e] || e.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());
}

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

const STAGE_ICON: Record<TradingStageId, typeof BookOpen> = {
  learn: BookOpen,
  strategy: Layers,
  validation: Radar,
  sandbox: Zap,
  evaluation: Target,
  qualification: Compass,
  live: TrendingUp,
};

function money(v?: number): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

export default function HomePage() {
  const { user } = useAuth() as { user?: any };
  const [, navigate] = useLocation();
  const isAdmin = !!user?.isAdmin || !!user?.claims?.isAdmin;
  const [progression, setProgression] = useState<TradingProgression | null>(null);
  const [openTrades, setOpenTrades] = useState<PaperTrade[]>([]);
  const [performance, setPerformance] = useState<TradingPerformanceReport | null>(null);
  const [approvalsCount, setApprovalsCount] = useState<number>(0);
  const [activity, setActivity] = useState<RuntimeEvent[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [memory, setMemory] = useState<ObjectGraph | null>(null);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const getJson = (url: string) =>
      fetch(url, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    const results = await Promise.all([
      getJson("/api/trading/progression"),
      getJson("/api/trading/paper-trades?status=open"),
      getJson("/api/trading/performance"),
      getJson("/api/projects"),
      getJson("/api/me/memory/graph"),
      getJson("/api/budget"),
      isAdmin ? getJson("/api/admin/approval-queue") : Promise.resolve(null),
      isAdmin ? getJson("/api/admin/logs") : Promise.resolve(null),
    ]);
    const [progRes, tradesRes, perfRes, projectsRes, memoryRes, budgetRes, approvalsRes, logsRes] =
      results;

    setProgression(progRes?.progression || null);
    setOpenTrades(tradesRes?.trades || []);
    setPerformance(perfRes?.report || null);
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
    setActivity(
      Array.isArray(logsRes?.runtime)
        ? [...logsRes.runtime].reverse().slice(0, 8)
        : [],
    );
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentStageDef = useMemo(() => {
    const fallback = TRADING_STAGES.find((s) => s.id === "sandbox") || TRADING_STAGES[3];
    if (!progression) return fallback;
    return (
      TRADING_STAGES.find((s) => s.id === progression.currentStage) || fallback
    );
  }, [progression]);

  const StageIcon = STAGE_ICON[currentStageDef.id];
  const displayName =
    user?.displayName || user?.personalization?.displayName || user?.username || "there";

  const totalPnl = performance?.expectancy
    ? performance.expectancy * (performance.closedTrades || 0)
    : 0;

  const recentMemoryObjects = useMemo<BaseObject[]>(() => {
    const list = [...(memory?.objects || [])];
    list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return list.slice(0, 4);
  }, [memory]);
  const memoryObjectCount = memory?.objects?.length ?? 0;
  const memoryTypeCount = useMemo(() => {
    const set = new Set<string>();
    for (const o of memory?.objects || []) set.add(o.type);
    return set.size;
  }, [memory]);
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
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              <span className="sr-only sm:not-sr-only">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Approvals banner (admin, when there are pending) */}
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

        {/* Quick actions */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <QuickAction
            icon={MessageSquare}
            label="Ask Zed"
            onClick={() => navigate("/chat")}
          />
          <QuickAction
            icon={Plus}
            label="Log a trade"
            onClick={() => navigate("/trading")}
          />
          {isAdmin ? (
            <QuickAction
              icon={ShieldAlert}
              label={approvalsCount > 0 ? `${approvalsCount} pending` : "Approvals"}
              onClick={() => navigate("/admin")}
              emphasis={approvalsCount > 0}
            />
          ) : (
            <QuickAction
              icon={BookOpen}
              label="Learn"
              onClick={() => navigate("/trading")}
            />
          )}
        </section>

        {/* Current stage */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 flex items-center justify-center">
              <StageIcon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] uppercase tracking-[0.08em] text-cyan-400/70 mb-0.5">
                Stage {currentStageDef.order} of 7
              </div>
              <div className="text-[16.5px] font-semibold text-white tracking-[-0.01em]">
                {currentStageDef.label}
              </div>
              <div className="mt-1 text-[13px] text-white/60 leading-snug max-w-full sm:max-w-[62ch]">
                {currentStageDef.purpose}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/trading")}
              className="shrink-0 hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 transition-colors active:opacity-80"
            >
              Open
              <ArrowRight size={12} />
            </button>
          </div>
        </section>

        {/* Workspace launcher */}
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

        {/* Knowledge library glance */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
              What Zed knows
            </div>
            <button
              type="button"
              onClick={() => navigate("/learning")}
              className="text-[12px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
            >
              Knowledge library <ArrowRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            <StatPill label="Objects" value={String(memoryObjectCount)} />
            <StatPill label="Types" value={String(memoryTypeCount)} />
            <StatPill
              label="Last learned"
              value={
                recentMemoryObjects[0]
                  ? friendlyTime(recentMemoryObjects[0].updatedAt)
                  : "—"
              }
            />
          </div>
          {recentMemoryObjects.length === 0 ? (
            <div className="text-[12.5px] text-white/40">
              Nothing yet. Add notes on the Knowledge library and Zed will start remembering.
            </div>
          ) : (
            <div className="space-y-1">
              {recentMemoryObjects.map((o) => (
                <div
                  key={o.id}
                  className="flex items-start gap-2 px-1 py-1"
                >
                  <BookOpen size={12} className="text-cyan-300/70 shrink-0 mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-white/85 truncate">
                      {o.canonicalName}
                    </div>
                    {o.summary && (
                      <div className="text-[11px] text-white/40 line-clamp-1">
                        {o.summary}
                      </div>
                    )}
                  </div>
                  <span className="text-[10.5px] uppercase tracking-[0.08em] text-white/35 shrink-0">
                    {o.type.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Projects strip */}
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

        {/* Budget snapshot */}
        {budget && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
                Budget snapshot
              </div>
              <button
                type="button"
                onClick={() => navigate("/budget")}
                className="text-[12px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
              >
                Open budget <ArrowRight size={11} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <StatPill label="Treasury" value={money(treasuryBalance)} />
              <StatPill label="Pending" value={money(pendingAllocation)} />
              <StatPill
                label="Milestone"
                value={treasuryLabel || (treasuryBalance > 0 ? "Building" : "Not started")}
              />
            </div>
          </section>
        )}

        {/* Trading snapshot */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
              Paper trading
            </div>
            <button
              type="button"
              onClick={() => navigate("/trading")}
              className="text-[12px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
            >
              See all <ArrowRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatPill label="Open" value={String(openTrades.length)} />
            <StatPill
              label="Closed"
              value={String(performance?.closedTrades ?? "0")}
            />
            <StatPill
              label="Win rate"
              value={performance ? `${Math.round((performance.winRate || 0) * 100)}%` : "—"}
            />
            <StatPill label="Est. P&L" value={money(totalPnl)} />
          </div>
          {openTrades.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {openTrades.slice(0, 3).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 gap-3"
                >
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-white">{t.symbol}</span>
                    <span
                      className={`text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
                        t.direction === "long"
                          ? "bg-emerald-400/10 text-emerald-300/90"
                          : "bg-red-400/10 text-red-300/90"
                      }`}
                    >
                      {t.direction}
                    </span>
                    <span className="text-[11.5px] text-white/50">
                      entry ${t.entry} · stop ${t.stop}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/trading")}
                    className="text-[11.5px] text-cyan-300 hover:text-cyan-200"
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent activity — admin only */}
        {isAdmin && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
                What Zed's been doing
              </div>
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="text-[12px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
              >
                Activity feed <ArrowRight size={11} />
              </button>
            </div>
            {activity.length === 0 ? (
              <div className="text-[12.5px] text-white/40">Nothing recent to show.</div>
            ) : (
              <div className="space-y-1">
                {activity.map((evt, i) => {
                  const dotColor =
                    evt.level === "error"
                      ? "bg-red-400"
                      : evt.level === "warn"
                        ? "bg-yellow-400"
                        : "bg-cyan-400/60";
                  return (
                    <div
                      key={`${evt.timestamp}-${i}`}
                      className="flex items-start gap-2.5 px-1 py-1.5"
                    >
                      <span
                        className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${dotColor}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] text-white/85 leading-snug">
                          {friendlyEvent(evt.event)}
                        </div>
                        <div className="text-[11px] text-white/40">
                          {friendlyTime(evt.timestamp)}
                          {evt.detail ? ` · ${evt.detail.slice(0, 80)}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <div className="pt-2 text-center text-[11.5px] text-white/30">
          <LineChart size={11} className="inline mr-1 opacity-60" />
          Zed refreshes this every time you land here.
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
  icon: any;
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

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.08em] text-white/40">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold text-white tabular-nums">{value}</div>
    </div>
  );
}
