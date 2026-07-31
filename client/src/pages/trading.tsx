import { useEffect, useState } from "react";
import {
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TradingProgressionBanner from "@/components/trading/TradingProgressionBanner";
import TrainingConsole from "@/components/trading/TrainingConsole";
import KnowledgeSections from "@/components/trading/KnowledgeSections";
import SandboxWorkspace from "@/components/trading/SandboxWorkspace";
import LearnStage from "@/components/trading/LearnStage";
import StrategyStage from "@/components/trading/StrategyStage";
import ValidationStage from "@/components/trading/ValidationStage";
import ExternalPaperStage from "@/components/trading/ExternalPaperStage";
import EvaluationStage from "@/components/trading/EvaluationStage";
import QualificationStage from "@/components/trading/QualificationStage";
import LiveStage from "@/components/trading/LiveStage";
import type { TradingStageId } from "@shared/trading-progression";
import type {
  TradingGovernanceDecision,
  TradingIncidentReport,
} from "@shared/trading-types";

const FUNCTIONAL_STAGES: TradingStageId[] = [
  "learn",
  "strategy",
  "validation",
  "sandbox",
  "external_paper",
  "evaluation",
  "qualification",
  "live",
];

/**
 * The guided training stages (banner + stage tools) are the primary
 * surface. Below them, "ZAR's records" holds the two things the stages
 * don't cover: ZAR's governance audit trail. Everything else
 * (knowledge, strategies, paper trades,
 * performance) lives in the stage tools, so it isn't duplicated here.
 */

type RecordsTab = "governance";

const tabs: Array<{ id: RecordsTab; label: string }> = [
  { id: "governance", label: "Governance" },
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

function StatCard({
  label,
  value,
  note,
  valueClassName,
}: {
  label: string;
  value: string | number;
  note?: string;
  valueClassName?: string;
}) {
  return (
    <div className="zar-glass rounded-2xl p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${valueClassName || "text-white"}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

function GovernanceDecisionRow({ decision }: { decision: TradingGovernanceDecision }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={decisionBadgeClass(decision.decision)}>{decision.decision}</Badge>
          {decision.symbol && <span className="text-sm font-semibold">{decision.symbol}</span>}
        </div>
        <span className="text-xs text-muted-foreground">{formatDate(decision.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{decision.reason}</p>

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="mt-2 text-xs text-cyan-300 hover:text-cyan-200"
      >
        {detailsOpen ? "Hide" : "Show"} ZAR's checklist &amp; evidence
      </button>

      {detailsOpen && (
        <>
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
        </>
      )}
    </div>
  );
}

function Panel({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="zar-glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

export default function TradingPage() {
  const [currentStage, setCurrentStage] = useState<TradingStageId | null>(null);
  const [showRecords, setShowRecords] = useState<boolean>(false);
  const [tab, setTab] = useState<RecordsTab>("governance");

  const [governanceDecisions, setGovernanceDecisions] = useState<TradingGovernanceDecision[]>([]);
  const [incidents, setIncidents] = useState<TradingIncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [governanceData, incidentData] = await Promise.all([
        apiGet<{ decisions: TradingGovernanceDecision[] }>("/api/trading/governance/decisions"),
        apiGet<{ incidents: TradingIncidentReport[] }>("/api/trading/governance/incidents"),
      ]);
      setGovernanceDecisions(governanceData.decisions || []);
      setIncidents(incidentData.incidents || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load ZAR's records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const latestGovernanceDecision = governanceDecisions[0];
  const sample = latestGovernanceDecision?.paperTradingProgress;

  async function runGovernanceReview() {
    const response = await apiSend<{ governanceDecision: TradingGovernanceDecision }>("/api/trading/governance/review", "POST", {});
    setNotice(`Governance review complete: ${response.governanceDecision.decision}.`);
    setTab("governance");
    await refresh();
  }

  const recordsOpen = showRecords || !currentStage || !FUNCTIONAL_STAGES.includes(currentStage);

  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          className="rounded-xl text-xs text-muted-foreground hover:text-foreground zar-button"
        >
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
      </div>

      <main className="mx-auto max-w-6xl space-y-4">
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

        {currentStage && FUNCTIONAL_STAGES.includes(currentStage) && !showRecords && (
          <div id="stage-tool" className="space-y-4 scroll-mt-20">
            {currentStage === "learn" && (
              <>
                <KnowledgeSections />
                <TrainingConsole />
                <LearnStage />
              </>
            )}
            {currentStage === "strategy" && <StrategyStage />}
            {currentStage === "validation" && <ValidationStage />}
            {currentStage === "sandbox" && <SandboxWorkspace />}
            {currentStage === "external_paper" && <ExternalPaperStage />}
            {currentStage === "evaluation" && <EvaluationStage />}
            {currentStage === "qualification" && <QualificationStage />}
            {currentStage === "live" && <LiveStage />}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-white/[0.06]">
          <div className="text-[11.5px] uppercase tracking-[0.08em] text-white/40">ZAR's records</div>
          <button
            type="button"
            onClick={() => setShowRecords((v) => !v)}
            className="text-[12px] text-white/50 hover:text-white/80 transition-colors"
          >
            {showRecords ? "Hide records" : "Show records"}
          </button>
        </div>

        {recordsOpen && (
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

        {recordsOpen &&
          (loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading ZAR's records...</div>
          ) : (
            <>
              {tab === "governance" && (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <StatCard label="Decisions" value={governanceDecisions.length} note="audit trail" />
                    <StatCard label="Incidents" value={incidents.length} note="risk denials" />
                    <StatCard
                      label="Live Eligibility"
                      value={latestGovernanceDecision?.liveTradingEligibility || "Not Eligible"}
                      note="live trading disabled"
                      valueClassName={
                        latestGovernanceDecision?.liveTradingEligibility &&
                        latestGovernanceDecision.liveTradingEligibility !== "Not Eligible"
                          ? "text-emerald-300"
                          : "text-red-300"
                      }
                    />
                    <StatCard
                      label="Sample Size"
                      value={`${sample?.currentSampleSize ?? 0}/${sample?.requiredSampleSize ?? 100}`}
                      note="validation target"
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                    <Panel title="Decision History" icon={<ShieldCheck size={16} className="text-emerald-300" />}>
                      <div className="mb-3 flex justify-end">
                        <Button size="sm" onClick={runGovernanceReview} className="rounded-xl zar-gradient">Run Governance Review</Button>
                      </div>
                      <div className="space-y-3">
                        {governanceDecisions.map((decision) => (
                          <GovernanceDecisionRow key={decision.id} decision={decision} />
                        ))}
                        {governanceDecisions.length === 0 && (
                          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-sm text-muted-foreground">
                            No governance decisions yet.
                          </div>
                        )}
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
                        {incidents.length === 0 && (
                          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-sm text-muted-foreground">
                            No governance incidents recorded.
                          </div>
                        )}
                      </div>
                    </Panel>
                  </div>
                </div>
              )}
            </>
          ))}
      </main>
    </>
  );
}
