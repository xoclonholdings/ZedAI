import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ClipboardList,
  LineChart,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TradingProgressionBanner from "@/components/trading/TradingProgressionBanner";
import TrainingConsole from "@/components/trading/TrainingConsole";
import SandboxWorkspace from "@/components/trading/SandboxWorkspace";
import LearnStage from "@/components/trading/LearnStage";
import StrategyStage from "@/components/trading/StrategyStage";
import ValidationStage from "@/components/trading/ValidationStage";
import type { TradingStageId } from "@shared/trading-progression";

const FUNCTIONAL_STAGES: TradingStageId[] = ["learn", "strategy", "validation", "sandbox"];
import type {
  PaperTrade,
  TradeThesis,
  TradingGovernanceDecision,
  TradingIncidentReport,
  TradingKnowledgeEntry,
  TradingPerformanceReport,
  TradingViewRecord,
} from "@shared/trading-types";

type TradingTab = "overview" | "knowledge" | "theses" | "paper" | "governance" | "tradingview" | "performance";

interface TradingStatus {
  status: string;
  phase: number;
  mode: string;
  markets: string[];
  requiredKnowledgeAreas: number;
  buildSteps: number;
  primarySources: string[];
  restrictions: string[];
}

interface Curriculum {
  sources: Array<{ name: string; type: string; purpose: string; url?: string }>;
  knowledgeAreas: Array<{ id: string; title: string; requiredTopics: string[] }>;
  buildSequence: Array<{ order: number; name: string; purpose: string }>;
}

const emptyStatus: TradingStatus = {
  status: "loading",
  phase: 1,
  mode: "education-analysis-simulation-only",
  markets: [],
  requiredKnowledgeAreas: 0,
  buildSteps: 0,
  primarySources: [],
  restrictions: [],
};

const tabs: Array<{ id: TradingTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "knowledge", label: "Knowledge" },
  { id: "theses", label: "Theses" },
  { id: "paper", label: "Paper Trades" },
  { id: "governance", label: "Governance" },
  { id: "tradingview", label: "TradingView" },
  { id: "performance", label: "Performance" },
];

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiSend<T>(url: string, method: "POST" | "PATCH", body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.authorization?.reason || data?.error || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return data;
}

function splitList(value: string): string[] {
  return value
    .split("\n")
    .flatMap((line) => line.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value?: string): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function decisionBadgeClass(decision?: string): string {
  if (!decision) return "border-white/10 bg-white/[0.04] text-muted-foreground";
  if (["APPROVED", "AUTHORIZED"].includes(decision)) return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (["CONDITIONALLY_APPROVED", "AUTHORIZED_WITH_CONDITIONS", "PAPER_TRADE_ONLY"].includes(decision)) return "border-yellow-400/30 bg-yellow-500/10 text-yellow-100";
  if (["REQUIRES_REVISION"].includes(decision)) return "border-orange-400/30 bg-orange-500/10 text-orange-100";
  return "border-red-400/30 bg-red-500/10 text-red-200";
}

function StatCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

function Panel({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-[0_0_24px_rgba(147,51,234,0.12)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-cyan-400/50 ${props.className || ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-cyan-400/50 ${props.className || ""}`}
    />
  );
}

export default function TradingPage() {
  const [, navigate] = useLocation();
  const [currentStage, setCurrentStage] = useState<TradingStageId | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [tab, setTab] = useState<TradingTab>("overview");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trading/progression", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCurrentStage(data?.progression?.currentStage || null);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [status, setStatus] = useState<TradingStatus>(emptyStatus);
  const [curriculum, setCurriculum] = useState<Curriculum>({ sources: [], knowledgeAreas: [], buildSequence: [] });
  const [knowledge, setKnowledge] = useState<TradingKnowledgeEntry[]>([]);
  const [theses, setTheses] = useState<TradeThesis[]>([]);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [performance, setPerformance] = useState<TradingPerformanceReport | null>(null);
  const [tvRecords, setTvRecords] = useState<TradingViewRecord[]>([]);
  const [governanceDecisions, setGovernanceDecisions] = useState<TradingGovernanceDecision[]>([]);
  const [incidents, setIncidents] = useState<TradingIncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeCategory, setKnowledgeCategory] = useState("all");
  const [knowledgeForm, setKnowledgeForm] = useState({
    source: "Trades By Sci",
    sourceType: "trades_by_sci",
    title: "",
    text: "",
    tags: "",
  });
  const [thesisForm, setThesisForm] = useState({
    market: "Crypto",
    assetClass: "crypto",
    symbol: "BTC",
    direction: "long",
    primaryTimeframe: "4H",
    reason: "",
    marketStructure: "",
    liquidityAnalysis: "",
    entryPlan: "",
    stopPlan: "",
    targetPlan: "",
    riskReward: "2",
    invalidationConditions: "",
    confidenceScore: "70",
  });
  const [paperForm, setPaperForm] = useState({
    thesisId: "",
    market: "Crypto",
    assetClass: "crypto",
    symbol: "BTC",
    direction: "long",
    timeframe: "4H",
    setupName: "",
    entry: "",
    stop: "",
    target: "",
    size: "1",
    riskAmount: "",
    entryReason: "",
  });
  const [tvForm, setTvForm] = useState({
    type: "watchlist",
    symbol: "BTC",
    assetClass: "crypto",
    timeframe: "4H",
    title: "",
    chartUrl: "",
    trigger: "",
    notes: "",
    tags: "",
  });

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [statusData, curriculumData, knowledgeData, thesesData, tradesData, performanceData, tvData, governanceData, incidentData] = await Promise.all([
        apiGet<TradingStatus>("/api/trading/phase1/status"),
        apiGet<Curriculum>("/api/trading/curriculum"),
        apiGet<{ entries: TradingKnowledgeEntry[] }>("/api/trading/knowledge"),
        apiGet<{ theses: TradeThesis[] }>("/api/trading/theses"),
        apiGet<{ trades: PaperTrade[] }>("/api/trading/paper-trades"),
        apiGet<{ report: TradingPerformanceReport }>("/api/trading/performance"),
        apiGet<{ records: TradingViewRecord[] }>("/api/trading/tradingview/records"),
        apiGet<{ decisions: TradingGovernanceDecision[] }>("/api/trading/governance/decisions"),
        apiGet<{ incidents: TradingIncidentReport[] }>("/api/trading/governance/incidents"),
      ]);
      setStatus(statusData);
      setCurriculum(curriculumData);
      setKnowledge(knowledgeData.entries || []);
      setTheses(thesesData.theses || []);
      setTrades(tradesData.trades || []);
      setPerformance(performanceData.report || null);
      setTvRecords(tvData.records || []);
      setGovernanceDecisions(governanceData.decisions || []);
      setIncidents(incidentData.incidents || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load trading intelligence");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filteredKnowledge = useMemo(() => {
    const q = knowledgeQuery.toLowerCase().trim();
    return knowledge.filter((entry) => {
      const categoryOk = knowledgeCategory === "all" || entry.category === knowledgeCategory;
      const queryOk =
        !q ||
        [entry.title, entry.source, entry.category, ...entry.concepts, ...entry.rules, ...entry.patterns, ...entry.tags]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return categoryOk && queryOk;
    });
  }, [knowledge, knowledgeCategory, knowledgeQuery]);

  const openTrades = trades.filter((trade) => trade.status === "open");
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const lessons = closedTrades.flatMap((trade) => trade.lessonsLearned).filter(Boolean).slice(0, 8);
  const latestGovernanceDecision = governanceDecisions[0];

  async function submitKnowledge() {
    await apiSend("/api/trading/knowledge/import", "POST", {
      ...knowledgeForm,
      tags: splitList(knowledgeForm.tags),
    });
    setKnowledgeForm((prev) => ({ ...prev, title: "", text: "", tags: "" }));
    setNotice("Knowledge imported.");
    await refresh();
  }

  async function submitThesis() {
    const response = await apiSend<{ governanceDecision: TradingGovernanceDecision }>("/api/trading/theses", "POST", {
      ...thesisForm,
      riskReward: Number(thesisForm.riskReward),
      confidenceScore: Number(thesisForm.confidenceScore),
      invalidationConditions: splitList(thesisForm.invalidationConditions),
      timeframeAlignment: { primary: thesisForm.primaryTimeframe },
    });
    setNotice(`Trade thesis created. Governance decision: ${response.governanceDecision.decision}.`);
    await refresh();
  }

  async function reviewThesisGovernance(id: string) {
    const response = await apiSend<{ governanceDecision: TradingGovernanceDecision }>(`/api/trading/theses/${id}/governance`, "POST", {});
    setNotice(`Governance reviewed: ${response.governanceDecision.decision}.`);
    await refresh();
  }

  async function archiveThesis(id: string) {
    await apiSend(`/api/trading/theses/${id}/archive`, "POST", {});
    setNotice("Thesis archived.");
    await refresh();
  }

  async function submitPaperTrade() {
    const response = await apiSend<{ authorization: TradingGovernanceDecision }>("/api/trading/paper-trades", "POST", {
      ...paperForm,
      entry: Number(paperForm.entry),
      stop: Number(paperForm.stop),
      target: Number(paperForm.target),
      size: Number(paperForm.size),
      riskAmount: Number(paperForm.riskAmount),
    });
    setNotice(`Paper trade opened. Authorization: ${response.authorization.decision}.`);
    await refresh();
  }

  async function closeTrade(trade: PaperTrade) {
    const exitPrice = window.prompt(`Close ${trade.symbol} at what exit price?`);
    if (!exitPrice) return;
    const lessons = window.prompt("Lessons learned? Separate multiple with commas.") || "";
    const violations = window.prompt("Rule violations? Separate multiple with commas.") || "";
    await apiSend(`/api/trading/paper-trades/${trade.id}/close`, "POST", {
      exitPrice: Number(exitPrice),
      lessonsLearned: splitList(lessons),
      ruleViolations: splitList(violations),
    });
    setNotice("Paper trade closed and review report generated.");
    await refresh();
  }

  async function runGovernanceReview() {
    const response = await apiSend<{ governanceDecision: TradingGovernanceDecision }>("/api/trading/governance/review", "POST", {});
    setNotice(`Governance review complete: ${response.governanceDecision.decision}.`);
    setTab("governance");
    await refresh();
  }

  async function submitTradingViewRecord() {
    await apiSend("/api/trading/tradingview/records", "POST", {
      ...tvForm,
      tags: splitList(tvForm.tags),
    });
    setNotice("TradingView record saved.");
    await refresh();
  }

  async function importSnapshot() {
    await apiSend("/api/trading/tradingview/snapshot", "POST", {
      symbol: tvForm.symbol,
      assetClass: tvForm.assetClass,
      timeframe: tvForm.timeframe,
      chartUrl: tvForm.chartUrl,
      notes: tvForm.notes,
      tags: splitList(tvForm.tags),
    });
    setNotice("TradingView snapshot imported into knowledge and records.");
    await refresh();
  }

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
          <LineChart size={16} className="text-cyan-300" />
          <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-fuchsia-400 bg-clip-text font-bold text-transparent">
            Trading Intelligence
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          className="rounded-xl text-xs text-muted-foreground hover:text-foreground zed-button"
        >
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
      </div>

      <main className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <TradingProgressionBanner
          onProgressionChange={(p) => setCurrentStage(p.currentStage)}
          onOpenStageTool={() =>
            document
              .getElementById("stage-tool")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}
        {notice && <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-cyan-200">{notice}</div>}

        {currentStage &&
          FUNCTIONAL_STAGES.includes(currentStage) &&
          !showAdvanced && (
            <div id="stage-tool" className="space-y-4 scroll-mt-20">
              {currentStage === "learn" && (
                <>
                  <TrainingConsole />
                  <LearnStage />
                </>
              )}
              {currentStage === "strategy" && <StrategyStage />}
              {currentStage === "validation" && <ValidationStage />}
              {currentStage === "sandbox" && <SandboxWorkspace />}
            </div>
          )}

        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-white/[0.06]">
          <div className="text-[11.5px] uppercase tracking-[0.08em] text-white/40">
            Advanced tools
          </div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[12px] text-white/50 hover:text-white/80 transition-colors"
          >
            {showAdvanced ? "Hide advanced" : "Show advanced"}
          </button>
        </div>

        {(showAdvanced ||
          !currentStage ||
          !FUNCTIONAL_STAGES.includes(currentStage)) && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
                  tab === item.id
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {(showAdvanced ||
          !currentStage ||
          !FUNCTIONAL_STAGES.includes(currentStage)) &&
          (loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading trading intelligence...</div>
        ) : (
          <>
            {tab === "overview" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <StatCard label="Knowledge Areas" value={status.requiredKnowledgeAreas} note="minimum curriculum" />
                  <StatCard label="Open Trades" value={openTrades.length} note="paper only" />
                  <StatCard label="Closed Trades" value={closedTrades.length} note="journal source" />
                  <StatCard label="Win Rate" value={`${(((performance?.winRate || 0) * 100)).toFixed(1)}%`} note="paper trades" />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Build Progress" icon={<TrendingUp size={16} className="text-cyan-300" />}>
                    <div className="space-y-2">
                      {curriculum.buildSequence.map((step) => (
                        <div key={step.order} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-sm font-medium">{step.order}. {step.name}</div>
                          <div className="mt-1 text-xs leading-5 text-muted-foreground">{step.purpose}</div>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="Governance Snapshot" icon={<ShieldCheck size={16} className="text-emerald-300" />}>
                    {latestGovernanceDecision ? (
                      <div className="space-y-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={decisionBadgeClass(latestGovernanceDecision.decision)}>{latestGovernanceDecision.decision}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(latestGovernanceDecision.createdAt)}</span>
                        </div>
                        <p className="leading-6 text-muted-foreground">{latestGovernanceDecision.reason}</p>
                        <Button size="sm" onClick={runGovernanceReview} className="rounded-xl zed-gradient">Run Governance Review</Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">No governance decisions yet. Create a thesis or open a paper trade to begin the audit trail.</p>
                        <Button size="sm" onClick={runGovernanceReview} className="rounded-xl zed-gradient">Run Governance Review</Button>
                      </div>
                    )}
                  </Panel>

                  <Panel title="Recent Lessons" icon={<BookOpen size={16} className="text-purple-300" />}>
                    {lessons.length ? (
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {lessons.map((lesson, index) => <li key={`${lesson}-${index}`}>- {lesson}</li>)}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No closed paper-trade lessons yet.</p>
                    )}
                  </Panel>
                </div>
              </div>
            )}

            {tab === "knowledge" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <Panel title="Import Knowledge" icon={<BookOpen size={16} className="text-cyan-300" />}>
                  <div className="space-y-2">
                    <TextInput placeholder="Source" value={knowledgeForm.source} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, source: e.target.value })} />
                    <TextInput placeholder="Title" value={knowledgeForm.title} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })} />
                    <TextInput placeholder="Source type" value={knowledgeForm.sourceType} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, sourceType: e.target.value })} />
                    <TextArea placeholder="Paste structured notes, lesson summary, or transcript excerpt" value={knowledgeForm.text} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, text: e.target.value })} />
                    <TextInput placeholder="Tags, comma separated" value={knowledgeForm.tags} onChange={(e) => setKnowledgeForm({ ...knowledgeForm, tags: e.target.value })} />
                    <Button onClick={submitKnowledge} className="w-full rounded-xl zed-gradient">Import</Button>
                  </div>
                </Panel>

                <Panel title="Explore Knowledge" icon={<Search size={16} className="text-purple-300" />}>
                  <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px]">
                    <TextInput placeholder="Search concepts, rules, mistakes..." value={knowledgeQuery} onChange={(e) => setKnowledgeQuery(e.target.value)} />
                    <select value={knowledgeCategory} onChange={(e) => setKnowledgeCategory(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
                      <option value="all">All categories</option>
                      {curriculum.knowledgeAreas.map((area) => <option key={area.id} value={area.id}>{area.title}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    {filteredKnowledge.slice(0, 12).map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold">{entry.title}</div>
                          <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-200">{entry.category}</Badge>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">{entry.source}</div>
                        <div className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground md:grid-cols-2">
                          <div><span className="text-white">Rules:</span> {entry.rules.slice(0, 3).join(" | ") || "None extracted"}</div>
                          <div><span className="text-white">Mistakes:</span> {entry.mistakes.slice(0, 3).join(" | ") || "None extracted"}</div>
                          <div><span className="text-white">Examples:</span> {entry.examples.slice(0, 2).join(" | ") || "None extracted"}</div>
                          <div><span className="text-white">Best:</span> {entry.bestPractices.slice(0, 2).join(" | ") || "None extracted"}</div>
                        </div>
                      </div>
                    ))}
                    {filteredKnowledge.length === 0 && <p className="text-sm text-muted-foreground">No knowledge matches yet.</p>}
                  </div>
                </Panel>
              </div>
            )}

            {tab === "theses" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <Panel title="Create Thesis" icon={<Target size={16} className="text-cyan-300" />}>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-2 gap-2"><TextInput placeholder="Market" value={thesisForm.market} onChange={(e) => setThesisForm({ ...thesisForm, market: e.target.value })} /><TextInput placeholder="Symbol" value={thesisForm.symbol} onChange={(e) => setThesisForm({ ...thesisForm, symbol: e.target.value })} /></div>
                    <div className="grid grid-cols-3 gap-2"><TextInput placeholder="Asset class" value={thesisForm.assetClass} onChange={(e) => setThesisForm({ ...thesisForm, assetClass: e.target.value })} /><TextInput placeholder="Direction" value={thesisForm.direction} onChange={(e) => setThesisForm({ ...thesisForm, direction: e.target.value })} /><TextInput placeholder="Timeframe" value={thesisForm.primaryTimeframe} onChange={(e) => setThesisForm({ ...thesisForm, primaryTimeframe: e.target.value })} /></div>
                    <TextArea placeholder="Reason" value={thesisForm.reason} onChange={(e) => setThesisForm({ ...thesisForm, reason: e.target.value })} />
                    <TextArea placeholder="Market structure" value={thesisForm.marketStructure} onChange={(e) => setThesisForm({ ...thesisForm, marketStructure: e.target.value })} />
                    <TextArea placeholder="Liquidity analysis" value={thesisForm.liquidityAnalysis} onChange={(e) => setThesisForm({ ...thesisForm, liquidityAnalysis: e.target.value })} />
                    <TextArea placeholder="Entry plan" value={thesisForm.entryPlan} onChange={(e) => setThesisForm({ ...thesisForm, entryPlan: e.target.value })} />
                    <TextArea placeholder="Stop plan" value={thesisForm.stopPlan} onChange={(e) => setThesisForm({ ...thesisForm, stopPlan: e.target.value })} />
                    <TextArea placeholder="Target plan" value={thesisForm.targetPlan} onChange={(e) => setThesisForm({ ...thesisForm, targetPlan: e.target.value })} />
                    <TextArea placeholder="Invalidation conditions" value={thesisForm.invalidationConditions} onChange={(e) => setThesisForm({ ...thesisForm, invalidationConditions: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2"><TextInput placeholder="R/R" value={thesisForm.riskReward} onChange={(e) => setThesisForm({ ...thesisForm, riskReward: e.target.value })} /><TextInput placeholder="Confidence" value={thesisForm.confidenceScore} onChange={(e) => setThesisForm({ ...thesisForm, confidenceScore: e.target.value })} /></div>
                    <Button onClick={submitThesis} className="rounded-xl zed-gradient">Create Thesis</Button>
                  </div>
                </Panel>

                <Panel title="Thesis Board" icon={<ClipboardList size={16} className="text-purple-300" />}>
                  <div className="space-y-3">
                    {theses.map((thesis) => (
                      <div key={thesis.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold">{thesis.symbol} {thesis.direction}</div>
                          <div className="flex flex-wrap gap-2">
                            <Badge>{thesis.status}</Badge>
                            <Badge>{thesis.confidenceScore}%</Badge>
                            {thesis.governanceDecision && <Badge className={decisionBadgeClass(thesis.governanceDecision)}>{thesis.governanceDecision}</Badge>}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{thesis.reason}</p>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                          <div><span className="text-white">Structure:</span> {thesis.marketStructure}</div>
                          <div><span className="text-white">Liquidity:</span> {thesis.liquidityAnalysis}</div>
                          <div><span className="text-white">Entry:</span> {thesis.entryPlan}</div>
                          <div><span className="text-white">Invalidation:</span> {thesis.invalidationConditions.join(", ")}</div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button size="sm" variant="ghost" onClick={() => reviewThesisGovernance(thesis.id)} className="rounded-xl text-muted-foreground">Review Governance</Button>
                          {!thesis.archivedAt && <Button size="sm" variant="ghost" onClick={() => archiveThesis(thesis.id)} className="rounded-xl text-muted-foreground">Archive</Button>}
                        </div>
                      </div>
                    ))}
                    {theses.length === 0 && <p className="text-sm text-muted-foreground">No theses yet.</p>}
                  </div>
                </Panel>
              </div>
            )}

            {tab === "paper" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <Panel title="Open Paper Trade" icon={<TrendingUp size={16} className="text-cyan-300" />}>
                  <div className="grid gap-2">
                    <select value={paperForm.thesisId} onChange={(e) => setPaperForm({ ...paperForm, thesisId: e.target.value })} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
                      <option value="">No thesis link</option>
                      {theses.map((thesis) => <option key={thesis.id} value={thesis.id}>{thesis.symbol} {thesis.direction} - {thesis.status}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2"><TextInput placeholder="Market" value={paperForm.market} onChange={(e) => setPaperForm({ ...paperForm, market: e.target.value })} /><TextInput placeholder="Symbol" value={paperForm.symbol} onChange={(e) => setPaperForm({ ...paperForm, symbol: e.target.value })} /></div>
                    <div className="grid grid-cols-3 gap-2"><TextInput placeholder="Asset" value={paperForm.assetClass} onChange={(e) => setPaperForm({ ...paperForm, assetClass: e.target.value })} /><TextInput placeholder="Direction" value={paperForm.direction} onChange={(e) => setPaperForm({ ...paperForm, direction: e.target.value })} /><TextInput placeholder="Timeframe" value={paperForm.timeframe} onChange={(e) => setPaperForm({ ...paperForm, timeframe: e.target.value })} /></div>
                    <TextInput placeholder="Setup name" value={paperForm.setupName} onChange={(e) => setPaperForm({ ...paperForm, setupName: e.target.value })} />
                    <div className="grid grid-cols-3 gap-2"><TextInput placeholder="Entry" value={paperForm.entry} onChange={(e) => setPaperForm({ ...paperForm, entry: e.target.value })} /><TextInput placeholder="Stop" value={paperForm.stop} onChange={(e) => setPaperForm({ ...paperForm, stop: e.target.value })} /><TextInput placeholder="Target" value={paperForm.target} onChange={(e) => setPaperForm({ ...paperForm, target: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2"><TextInput placeholder="Size" value={paperForm.size} onChange={(e) => setPaperForm({ ...paperForm, size: e.target.value })} /><TextInput placeholder="Risk amount" value={paperForm.riskAmount} onChange={(e) => setPaperForm({ ...paperForm, riskAmount: e.target.value })} /></div>
                    <TextArea placeholder="Reason for entry" value={paperForm.entryReason} onChange={(e) => setPaperForm({ ...paperForm, entryReason: e.target.value })} />
                    <Button onClick={submitPaperTrade} className="rounded-xl zed-gradient">Open Paper Trade</Button>
                  </div>
                </Panel>

                <Panel title="Trade Book" icon={<BarChart3 size={16} className="text-purple-300" />}>
                  <div className="space-y-3">
                    {trades.map((trade) => (
                      <div key={trade.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold">{trade.symbol} {trade.direction}</div>
                          <div className="flex flex-wrap gap-2">
                            <Badge className={trade.status === "open" ? "bg-cyan-500/10 text-cyan-200" : "bg-purple-500/10 text-purple-200"}>{trade.status}</Badge>
                            {trade.authorizationDecision && <Badge className={decisionBadgeClass(trade.authorizationDecision)}>{trade.authorizationDecision}</Badge>}
                          </div>
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                          <div>Entry {trade.entry}</div><div>Stop {trade.stop}</div><div>Target {trade.target}</div>
                          <div>Risk {trade.riskAmount}</div><div>P&L {trade.realizedPnl ?? "open"}</div><div>{trade.outcome || "pending"}</div>
                        </div>
                        {trade.reviewReport && (
                          <div className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-2 text-xs text-cyan-100">
                            Review: {trade.reviewReport.executionQuality}, compliance {trade.reviewReport.ruleCompliance}. Improvements: {trade.reviewReport.recommendedImprovements.join(" ")}
                          </div>
                        )}
                        {trade.status === "open" && <Button size="sm" onClick={() => closeTrade(trade)} className="mt-3 rounded-xl">Close Trade</Button>}
                      </div>
                    ))}
                    {trades.length === 0 && <p className="text-sm text-muted-foreground">No paper trades yet.</p>}
                  </div>
                </Panel>
              </div>
            )}

            {tab === "governance" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <StatCard label="Decisions" value={governanceDecisions.length} note="audit trail" />
                  <StatCard label="Incidents" value={incidents.length} note="risk denials" />
                  <StatCard label="Live Eligibility" value={latestGovernanceDecision?.liveTradingEligibility || "Not Eligible"} note="live trading disabled" />
                  <StatCard label="Sample Size" value={`${performance?.closedTrades || 0}/100`} note="validation target" />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                  <Panel title="Decision History" icon={<ShieldCheck size={16} className="text-emerald-300" />}>
                    <div className="mb-3 flex justify-end">
                      <Button size="sm" onClick={runGovernanceReview} className="rounded-xl zed-gradient">Run Governance Review</Button>
                    </div>
                    <div className="space-y-3">
                      {governanceDecisions.map((decision) => (
                        <div key={decision.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={decisionBadgeClass(decision.decision)}>{decision.decision}</Badge>
                              {decision.symbol && <span className="text-sm font-semibold">{decision.symbol}</span>}
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(decision.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{decision.reason}</p>
                          {decision.paperTradingProgress && (
                            <div className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-2 text-xs text-cyan-100">
                              Validation: {decision.paperTradingProgress.currentSampleSize}/{decision.paperTradingProgress.requiredSampleSize} trades. Status: {decision.paperTradingProgress.status}. Live eligibility: {decision.liveTradingEligibility || "Not Eligible"}.
                            </div>
                          )}
                          {decision.checklist && (
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {decision.checklist.map((item) => (
                                <div key={`${decision.id}-${item.key}`} className="rounded-lg border border-white/10 bg-black/30 p-2 text-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-white">{item.label}</span>
                                    <Badge className={decisionBadgeClass(item.result)}>{item.result}</Badge>
                                  </div>
                                  <p className="mt-1 leading-5 text-muted-foreground">{item.evidence}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                            <div><span className="text-white">Evidence:</span> {decision.supportingEvidence.slice(0, 3).join(" | ") || "None recorded"}</div>
                            <div><span className="text-white">Required:</span> {decision.requiredActions.join(" | ") || "None"}</div>
                          </div>
                        </div>
                      ))}
                      {governanceDecisions.length === 0 && <p className="text-sm text-muted-foreground">No governance decisions yet.</p>}
                    </div>
                  </Panel>

                  <Panel title="Incident Reports" icon={<ShieldAlert size={16} className="text-red-300" />}>
                    <div className="space-y-3">
                      {incidents.map((incident) => (
                        <div key={incident.id} className="rounded-xl border border-red-400/20 bg-red-500/[0.04] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold text-red-100">{incident.symbol || "Risk Incident"}</div>
                            <span className="text-xs text-muted-foreground">{formatDate(incident.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{incident.incident}</p>
                          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                            <div><span className="text-white">Cause:</span> {incident.cause}</div>
                            <div><span className="text-white">Rules:</span> {incident.rulesViolated.join(" | ") || "None"}</div>
                            <div><span className="text-white">Corrections:</span> {incident.requiredCorrections.join(" | ") || "None"}</div>
                          </div>
                        </div>
                      ))}
                      {incidents.length === 0 && <p className="text-sm text-muted-foreground">No governance incidents recorded.</p>}
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {tab === "tradingview" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <Panel title="TradingView Record" icon={<LineChart size={16} className="text-cyan-300" />}>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-2 gap-2"><TextInput placeholder="Type" value={tvForm.type} onChange={(e) => setTvForm({ ...tvForm, type: e.target.value })} /><TextInput placeholder="Symbol" value={tvForm.symbol} onChange={(e) => setTvForm({ ...tvForm, symbol: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2"><TextInput placeholder="Asset class" value={tvForm.assetClass} onChange={(e) => setTvForm({ ...tvForm, assetClass: e.target.value })} /><TextInput placeholder="Timeframe" value={tvForm.timeframe} onChange={(e) => setTvForm({ ...tvForm, timeframe: e.target.value })} /></div>
                    <TextInput placeholder="Title" value={tvForm.title} onChange={(e) => setTvForm({ ...tvForm, title: e.target.value })} />
                    <TextInput placeholder="TradingView link" value={tvForm.chartUrl} onChange={(e) => setTvForm({ ...tvForm, chartUrl: e.target.value })} />
                    <TextInput placeholder="Alert trigger / screener condition" value={tvForm.trigger} onChange={(e) => setTvForm({ ...tvForm, trigger: e.target.value })} />
                    <TextArea placeholder="Notes" value={tvForm.notes} onChange={(e) => setTvForm({ ...tvForm, notes: e.target.value })} />
                    <TextInput placeholder="Tags" value={tvForm.tags} onChange={(e) => setTvForm({ ...tvForm, tags: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2"><Button onClick={submitTradingViewRecord} className="rounded-xl zed-gradient">Save Record</Button><Button onClick={importSnapshot} className="rounded-xl" variant="secondary">Import Snapshot</Button></div>
                  </div>
                </Panel>

                <Panel title="TradingView Library" icon={<ClipboardList size={16} className="text-purple-300" />}>
                  <div className="space-y-3">
                    {tvRecords.map((record) => (
                      <div key={record.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{record.symbol}</span><Badge>{record.type}</Badge><Badge>{record.status}</Badge></div>
                        <div className="mt-2 text-sm text-white">{record.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{record.timeframe || "no timeframe"} {record.trigger ? `- ${record.trigger}` : ""}</div>
                        <p className="mt-2 text-sm text-muted-foreground">{record.notes}</p>
                        {record.chartUrl && <a className="mt-2 block text-xs text-cyan-300 underline" href={record.chartUrl} target="_blank" rel="noreferrer">Open chart</a>}
                      </div>
                    ))}
                    {tvRecords.length === 0 && <p className="text-sm text-muted-foreground">No TradingView records yet.</p>}
                  </div>
                </Panel>
              </div>
            )}

            {tab === "performance" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <StatCard label="Total Trades" value={performance?.totalTrades || 0} />
                  <StatCard label="Expectancy" value={performance?.expectancy ?? 0} />
                  <StatCard label="Profit Factor" value={performance?.profitFactor ?? 0} />
                  <StatCard label="Max Drawdown" value={performance?.maximumDrawdown ?? 0} />
                </div>
                <Panel title="Pattern Analytics" icon={<BarChart3 size={16} className="text-cyan-300" />}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ["Highest Win Rate", performance?.patternAnalytics?.highestWinRateSetups],
                      ["Lowest Win Rate", performance?.patternAnalytics?.lowestWinRateSetups],
                      ["Most Profitable", performance?.patternAnalytics?.mostProfitableConditions],
                      ["Mistakes", performance?.patternAnalytics?.mostCommonMistakes],
                      ["Rule Violations", performance?.patternAnalytics?.mostCommonRuleViolations],
                      ["Best Assets", performance?.patternAnalytics?.bestAssetClasses],
                      ["Worst Assets", performance?.patternAnalytics?.worstAssetClasses],
                      ["Best Timeframes", performance?.patternAnalytics?.bestTimeframes],
                    ].map(([label, items]) => (
                      <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-sm font-semibold">{String(label)}</div>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {Array.isArray(items) && items.length ? items.map((item) => <div key={item}>- {item}</div>) : <div>No data yet.</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}
          </>
        ))}
      </main>
    </div>
  );
}
