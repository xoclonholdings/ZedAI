import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  Coins,
  Landmark,
  PiggyBank,
  Receipt,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_ALLOCATION_RULE,
  INCOME_SOURCE_LABELS,
  allocateDeposit,
  allocationRuleTotal,
  evaluateTreasuryReadiness,
  formatCurrency,
  isValidAllocationRule,
  type AllocationBreakdown,
  type BudgetState,
  type DepositEntry,
  type IncomeSource,
  type TreasuryReadiness,
  type TreasuryStageDefinition,
} from "@shared/budget-types";

type BudgetTab = "overview" | "deposit" | "personal" | "treasury" | "reports" | "settings";

interface BudgetReport {
  generatedAt: string;
  depositCount: number;
  totalIncome: number;
  totalSaved: number;
  totalReservedForTaxes: number;
  totalSentToPayroll: number;
  totalRetainedByTreasury: number;
  treasuryStage: string;
  treasuryStageLabel: string;
  nextMilestoneLabel: string;
  amountToNextMilestone: number;
  bySource: Array<{ source: IncomeSource; count: number; income: number }>;
}

const tabs: Array<{ id: BudgetTab; label: string }> = [
  { id: "overview", label: "Dual Reserve" },
  { id: "deposit", label: "Deposit Allocation" },
  { id: "personal", label: "Personal Reserve" },
  { id: "treasury", label: "Treasury" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
];

const INCOME_SOURCE_OPTIONS: IncomeSource[] = ["employer", "doordash", "instacart", "manual", "other"];

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
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function formatDate(value?: string): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function StatCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="zar-glass rounded-2xl p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
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

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`zar-input w-full rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground ${props.className || ""}`}
    />
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-fuchsia-400" style={{ width: `${pct}%` }} />
    </div>
  );
}

function stageBadgeClass(stageId?: string): string {
  if (stageId === "liquidity_eligible") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (stageId === "liquidity_prep") return "border-yellow-400/30 bg-yellow-500/10 text-yellow-100";
  return "border-cyan-400/30 bg-cyan-500/10 text-cyan-100";
}

export default function BudgetPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<BudgetTab>("overview");
  const [state, setState] = useState<BudgetState | null>(null);
  const [stages, setStages] = useState<TreasuryStageDefinition[]>([]);
  const [readiness, setReadiness] = useState<TreasuryReadiness | null>(null);
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  const [report, setReport] = useState<BudgetReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [depositForm, setDepositForm] = useState({ amount: "400", source: "employer" as IncomeSource, note: "" });
  const [ruleForm, setRuleForm] = useState(DEFAULT_ALLOCATION_RULE);
  const [targetForm, setTargetForm] = useState({ savingsTarget: "", emergencyFundTarget: "", operatingReserveTarget: "" });
  const [balanceForm, setBalanceForm] = useState({ savingsBalance: "", emergencyFundBalance: "", treasuryBalance: "" });
  const [settingsForm, setSettingsForm] = useState({ treasuryLabel: "", personalReserveLabel: "", payrollLabel: "", payrollPath: "", currency: "USD" });

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [stateData, depositsData, reportData] = await Promise.all([
        apiGet<{ state: BudgetState; stages: TreasuryStageDefinition[]; readiness: TreasuryReadiness }>("/api/budget/state"),
        apiGet<{ deposits: DepositEntry[] }>("/api/budget/deposits"),
        apiGet<{ report: BudgetReport }>("/api/budget/report"),
      ]);
      setState(stateData.state);
      setStages(stateData.stages || []);
      setReadiness(stateData.readiness);
      setDeposits(depositsData.deposits || []);
      setReport(reportData.report || null);
      setRuleForm(stateData.state.rule);
      setTargetForm({
        savingsTarget: String(stateData.state.targets.savingsTarget),
        emergencyFundTarget: String(stateData.state.targets.emergencyFundTarget),
        operatingReserveTarget: String(stateData.state.targets.operatingReserveTarget),
      });
      setBalanceForm({
        savingsBalance: String(stateData.state.balances.savingsBalance),
        emergencyFundBalance: String(stateData.state.balances.emergencyFundBalance),
        treasuryBalance: String(stateData.state.balances.treasuryBalance),
      });
      setSettingsForm({
        treasuryLabel: stateData.state.settings.treasuryLabel,
        personalReserveLabel: stateData.state.settings.personalReserveLabel,
        payrollLabel: stateData.state.settings.payrollLabel,
        payrollPath: stateData.state.settings.payrollPath.join(" → "),
        currency: stateData.state.settings.currency,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load budget management");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const currency = state?.settings.currency || "USD";
  const treasuryLabel = state?.settings.treasuryLabel || "Business Treasury";
  const personalLabel = state?.settings.personalReserveLabel || "Personal Reserve";
  const payrollLabel = state?.settings.payrollLabel || "Personal Payroll";

  const previewAmount = Number(depositForm.amount);
  const previewBreakdown: AllocationBreakdown = useMemo(
    () => allocateDeposit(Number.isFinite(previewAmount) ? previewAmount : 0, ruleForm),
    [previewAmount, ruleForm],
  );
  const previewReadiness = useMemo(() => {
    if (!state) return null;
    return evaluateTreasuryReadiness(state.balances.treasuryBalance, state.targets.operatingReserveTarget);
  }, [state]);

  const ruleTotal = allocationRuleTotal(ruleForm);
  const ruleValid = isValidAllocationRule(ruleForm);

  async function recordDeposit() {
    try {
      const amount = Number(depositForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Enter a deposit amount greater than 0.");
        return;
      }
      await apiSend("/api/budget/deposits", "POST", {
        amount,
        source: depositForm.source,
        note: depositForm.note || undefined,
      });
      setNotice("Deposit allocated. Savings and treasury balances updated.");
      setDepositForm((prev) => ({ ...prev, note: "" }));
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to record deposit");
    }
  }

  async function saveRule() {
    try {
      await apiSend("/api/budget/rule", "PATCH", { ...ruleForm });
      setNotice("Allocation rule saved.");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save rule");
    }
  }

  async function saveTargets() {
    try {
      await apiSend("/api/budget/targets", "PATCH", {
        savingsTarget: Number(targetForm.savingsTarget),
        emergencyFundTarget: Number(targetForm.emergencyFundTarget),
        operatingReserveTarget: Number(targetForm.operatingReserveTarget),
      });
      setNotice("Reserve targets saved.");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save targets");
    }
  }

  async function saveBalances() {
    try {
      await apiSend("/api/budget/balances", "PATCH", {
        savingsBalance: Number(balanceForm.savingsBalance),
        emergencyFundBalance: Number(balanceForm.emergencyFundBalance),
        treasuryBalance: Number(balanceForm.treasuryBalance),
      });
      setNotice("Reserve balances saved.");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save balances");
    }
  }

  async function saveSettings() {
    try {
      await apiSend("/api/budget/settings", "PATCH", {
        treasuryLabel: settingsForm.treasuryLabel,
        personalReserveLabel: settingsForm.personalReserveLabel,
        payrollLabel: settingsForm.payrollLabel,
        currency: settingsForm.currency,
        payrollPath: settingsForm.payrollPath
          .split(/→|>|\n|,/)
          .map((step) => step.trim())
          .filter(Boolean),
      });
      setNotice("Budget settings saved.");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save settings");
    }
  }

  const currentStage = readiness?.stage;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/workspaces/finance")}
          className="rounded-xl text-muted-foreground hover:text-foreground zar-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Finance workspace
        </Button>
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
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            <Coins size={14} />
            Dual Reserve Strategy
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Every dollar strengthens both sides.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Income is split across your {personalLabel} and your {treasuryLabel}. Taxes and {payrollLabel.toLowerCase()} are
            handled first, savings and the treasury grow in parallel, and liquidity stays locked until the reserve is
            covered. This flow plans and recommends — it never trades, moves money, or seeds liquidity on its own.
          </p>
        </section>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}
        {notice && <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-cyan-200">{notice}</div>}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setNotice(null);
                setError(null);
              }}
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

        {loading || !state ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading budget management...</div>
        ) : (
          <>
            {tab === "overview" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <StatCard label={`${personalLabel} savings`} value={formatCurrency(state.balances.savingsBalance, currency)} note={`Target ${formatCurrency(state.targets.savingsTarget, currency)}`} />
                  <StatCard label="Emergency fund" value={formatCurrency(state.balances.emergencyFundBalance, currency)} note={`Target ${formatCurrency(state.targets.emergencyFundTarget, currency)}`} />
                  <StatCard label={treasuryLabel} value={formatCurrency(state.balances.treasuryBalance, currency)} note={currentStage?.label || "Build phase"} />
                  <StatCard label="Total income tracked" value={formatCurrency(report?.totalIncome || 0, currency)} note={`${report?.depositCount || 0} deposits`} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Personal Reserve" icon={<PiggyBank size={16} className="text-emerald-300" />}>
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Savings</span>
                          <span>{formatCurrency(state.balances.savingsBalance, currency)} / {formatCurrency(state.targets.savingsTarget, currency)}</span>
                        </div>
                        <ProgressBar value={state.balances.savingsBalance} max={state.targets.savingsTarget} />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Emergency fund</span>
                          <span>{formatCurrency(state.balances.emergencyFundBalance, currency)} / {formatCurrency(state.targets.emergencyFundTarget, currency)}</span>
                        </div>
                        <ProgressBar value={state.balances.emergencyFundBalance} max={state.targets.emergencyFundTarget} />
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">{state.targets.retirementNote}</p>
                    </div>
                  </Panel>

                  <Panel title={treasuryLabel} icon={<Landmark size={16} className="text-cyan-300" />}>
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={stageBadgeClass(currentStage?.id)}>{currentStage?.label || "Build phase"}</Badge>
                        <span className="text-xs text-muted-foreground">Operating reserve target {formatCurrency(state.targets.operatingReserveTarget, currency)}</span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Operating reserve</span>
                          <span>{formatCurrency(state.balances.treasuryBalance, currency)} / {formatCurrency(state.targets.operatingReserveTarget, currency)}</span>
                        </div>
                        <ProgressBar value={state.balances.treasuryBalance} max={state.targets.operatingReserveTarget} />
                      </div>
                      {readiness && <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-2 text-xs leading-5 text-cyan-100">{readiness.message}</p>}
                    </div>
                  </Panel>
                </div>

                <Panel title="Readiness" icon={<ShieldCheck size={16} className="text-emerald-300" />}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["Liquidity", readiness?.liquidityReady],
                      ["Buybacks", readiness?.buybackReady],
                      ["Strategic investments", readiness?.investmentReady],
                    ].map(([label, ready]) => (
                      <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-sm font-medium">{String(label)}</div>
                        <Badge className={ready ? "mt-2 border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "mt-2 border-white/10 bg-white/[0.04] text-muted-foreground"}>
                          {ready ? "Eligible (excess only)" : "Not ready yet"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => setTab("deposit")} className="mt-4 rounded-xl zar-gradient">
                    Allocate a deposit
                    <ArrowRight size={14} className="ml-1" />
                  </Button>
                </Panel>
              </div>
            )}

            {tab === "deposit" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <Panel title="Deposit Allocation Calculator" icon={<Wallet size={16} className="text-cyan-300" />}>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Income amount</label>
                      <TextInput
                        type="number"
                        inputMode="decimal"
                        placeholder="400"
                        value={depositForm.amount}
                        onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Income source</label>
                      <select
                        value={depositForm.source}
                        onChange={(e) => setDepositForm({ ...depositForm, source: e.target.value as IncomeSource })}
                        className="zar-input w-full rounded-xl px-3 py-2 text-sm text-white"
                      >
                        {INCOME_SOURCE_OPTIONS.map((source) => (
                          <option key={source} value={source}>{INCOME_SOURCE_LABELS[source]}</option>
                        ))}
                      </select>
                    </div>
                    <TextInput
                      placeholder="Note (optional)"
                      value={depositForm.note}
                      onChange={(e) => setDepositForm({ ...depositForm, note: e.target.value })}
                    />
                    <Button onClick={recordDeposit} className="w-full rounded-xl zar-gradient">Record deposit</Button>
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      Recording applies the savings and {treasuryLabel.toLowerCase()} shares to your tracked balances. Taxes
                      and {payrollLabel.toLowerCase()} are logged as obligations, not reserves.
                    </p>
                  </div>
                </Panel>

                <Panel title="The clean move" icon={<Coins size={16} className="text-fuchsia-300" />}>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deposit</div>
                      <div className="mt-1 text-2xl font-semibold text-white">{formatCurrency(previewBreakdown.total, currency)}</div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <AllocationRow icon={<PiggyBank size={15} className="text-emerald-300" />} label="Savings" value={formatCurrency(previewBreakdown.savings, currency)} pct={ruleForm.savingsPercent} />
                      <AllocationRow icon={<Receipt size={15} className="text-yellow-300" />} label="Taxes" value={formatCurrency(previewBreakdown.taxes, currency)} pct={ruleForm.taxPercent} />
                      <AllocationRow icon={<Wallet size={15} className="text-cyan-300" />} label={payrollLabel} value={formatCurrency(previewBreakdown.payroll, currency)} pct={ruleForm.payrollPercent} />
                      <AllocationRow icon={<Landmark size={15} className="text-fuchsia-300" />} label={treasuryLabel} value={formatCurrency(previewBreakdown.treasury, currency)} pct={ruleForm.treasuryPercent} />
                    </div>
                    {previewReadiness && (
                      <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs leading-5 text-cyan-100">{previewReadiness.message}</p>
                    )}
                  </div>
                </Panel>

                <div className="lg:col-span-2">
                  <Panel title="Deposit History" icon={<Receipt size={16} className="text-purple-300" />}>
                    <div className="space-y-2">
                      {deposits.map((deposit) => (
                        <div key={deposit.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{formatCurrency(deposit.amount, currency)}</span>
                              <Badge className="border-white/10 bg-white/[0.04] text-muted-foreground">{INCOME_SOURCE_LABELS[deposit.source]}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(deposit.createdAt)}</span>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-4">
                            <div>Savings {formatCurrency(deposit.allocation.savings, currency)}</div>
                            <div>Taxes {formatCurrency(deposit.allocation.taxes, currency)}</div>
                            <div>Payroll {formatCurrency(deposit.allocation.payroll, currency)}</div>
                            <div>Treasury {formatCurrency(deposit.allocation.treasury, currency)}</div>
                          </div>
                          {deposit.note && <div className="mt-2 text-xs text-white/60">{deposit.note}</div>}
                        </div>
                      ))}
                      {deposits.length === 0 && (
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-sm text-muted-foreground">
                          No deposits recorded yet.
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {tab === "personal" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Reserve Targets" icon={<PiggyBank size={16} className="text-emerald-300" />}>
                  <div className="space-y-3">
                    <LabeledInput label="Savings target" value={targetForm.savingsTarget} onChange={(v) => setTargetForm({ ...targetForm, savingsTarget: v })} />
                    <LabeledInput label="Emergency fund target" value={targetForm.emergencyFundTarget} onChange={(v) => setTargetForm({ ...targetForm, emergencyFundTarget: v })} />
                    <Button onClick={saveTargets} className="rounded-xl zar-gradient">Save targets</Button>
                  </div>
                </Panel>

                <Panel title="Reserve Balances" icon={<Wallet size={16} className="text-cyan-300" />}>
                  <div className="space-y-3">
                    <LabeledInput label="Current savings" value={balanceForm.savingsBalance} onChange={(v) => setBalanceForm({ ...balanceForm, savingsBalance: v })} />
                    <LabeledInput label="Emergency fund" value={balanceForm.emergencyFundBalance} onChange={(v) => setBalanceForm({ ...balanceForm, emergencyFundBalance: v })} />
                    <Button onClick={saveBalances} className="rounded-xl zar-gradient">Save balances</Button>
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      Recording deposits updates savings automatically. Adjust here to reconcile with your real accounts.
                    </p>
                  </div>
                </Panel>

                <div className="lg:col-span-2">
                  <Panel title="Retirement & investing" icon={<Building2 size={16} className="text-purple-300" />}>
                    <p className="text-sm leading-6 text-muted-foreground">{state.targets.retirementNote}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      This is organization and planning only — not investment advice, and no outcome is guaranteed. Route
                      long-term savings toward retirement or investing accounts once the emergency fund is covered.
                    </p>
                  </Panel>
                </div>
              </div>
            )}

            {tab === "treasury" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <StatCard label={`${treasuryLabel} balance`} value={formatCurrency(state.balances.treasuryBalance, currency)} note={currentStage?.label} />
                  <StatCard label="Operating reserve target" value={formatCurrency(state.targets.operatingReserveTarget, currency)} />
                  <StatCard label="Excess (eligible)" value={formatCurrency(readiness?.excessCapital || 0, currency)} note="only excess may be deployed" />
                </div>

                <Panel title="Set treasury balance & reserve" icon={<Landmark size={16} className="text-cyan-300" />}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LabeledInput label={`${treasuryLabel} balance`} value={balanceForm.treasuryBalance} onChange={(v) => setBalanceForm({ ...balanceForm, treasuryBalance: v })} />
                    <LabeledInput label="Operating reserve target" value={targetForm.operatingReserveTarget} onChange={(v) => setTargetForm({ ...targetForm, operatingReserveTarget: v })} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={saveBalances} className="rounded-xl zar-gradient">Save balance</Button>
                    <Button onClick={saveTargets} variant="secondary" className="rounded-xl">Save reserve target</Button>
                  </div>
                </Panel>

                <Panel title="Treasury readiness milestones" icon={<ShieldCheck size={16} className="text-emerald-300" />}>
                  <div className="space-y-3">
                    {stages.map((stage) => {
                      const active = currentStage?.id === stage.id;
                      return (
                        <div key={stage.id} className={`rounded-xl border p-3 ${active ? "border-cyan-400/40 bg-cyan-400/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge className={stageBadgeClass(stage.id)}>Stage {stage.order}</Badge>
                              <span className="text-sm font-semibold">{stage.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(stage.min, currency)}
                              {stage.max === null ? "+" : ` – ${formatCurrency(stage.max, currency)}`}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{stage.recommendation}</p>
                          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {stage.guardrails.map((g, i) => <li key={i}>- {g}</li>)}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                  {readiness && (
                    <p className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs leading-5 text-cyan-100">{readiness.message}</p>
                  )}
                </Panel>
              </div>
            )}

            {tab === "reports" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <StatCard label="Total income" value={formatCurrency(report?.totalIncome || 0, currency)} note={`${report?.depositCount || 0} deposits`} />
                  <StatCard label="Total saved" value={formatCurrency(report?.totalSaved || 0, currency)} />
                  <StatCard label="Reserved for taxes" value={formatCurrency(report?.totalReservedForTaxes || 0, currency)} />
                  <StatCard label="Sent to payroll" value={formatCurrency(report?.totalSentToPayroll || 0, currency)} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Treasury retained" icon={<Landmark size={16} className="text-cyan-300" />}>
                    <div className="text-2xl font-semibold text-white">{formatCurrency(report?.totalRetainedByTreasury || 0, currency)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge className={stageBadgeClass(report?.treasuryStage)}>{report?.treasuryStageLabel || "Build phase"}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Next: {report?.nextMilestoneLabel} ({formatCurrency(report?.amountToNextMilestone || 0, currency)} to go)
                      </span>
                    </div>
                  </Panel>
                  <Panel title="Income by source" icon={<Receipt size={16} className="text-purple-300" />}>
                    <div className="space-y-2">
                      {(report?.bySource || []).map((row) => (
                        <div key={row.source} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                          <span>{INCOME_SOURCE_LABELS[row.source]}</span>
                          <span className="text-muted-foreground">{row.count} · {formatCurrency(row.income, currency)}</span>
                        </div>
                      ))}
                      {(report?.bySource || []).length === 0 && (
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-sm text-muted-foreground">
                          No income logged yet.
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {tab === "settings" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Allocation Rule" icon={<Coins size={16} className="text-cyan-300" />}>
                  <div className="space-y-3">
                    <LabeledInput label="Savings %" value={String(ruleForm.savingsPercent)} onChange={(v) => setRuleForm({ ...ruleForm, savingsPercent: Number(v) })} />
                    <LabeledInput label="Tax %" value={String(ruleForm.taxPercent)} onChange={(v) => setRuleForm({ ...ruleForm, taxPercent: Number(v) })} />
                    <LabeledInput label="Payroll %" value={String(ruleForm.payrollPercent)} onChange={(v) => setRuleForm({ ...ruleForm, payrollPercent: Number(v) })} />
                    <LabeledInput label="Treasury %" value={String(ruleForm.treasuryPercent)} onChange={(v) => setRuleForm({ ...ruleForm, treasuryPercent: Number(v) })} />
                    <div className={`text-xs ${ruleValid ? "text-emerald-300" : "text-red-300"}`}>
                      Total: {ruleTotal}% {ruleValid ? "✓" : "(must equal 100)"}
                    </div>
                    <Button onClick={saveRule} disabled={!ruleValid} className="rounded-xl zar-gradient disabled:opacity-40">Save rule</Button>
                  </div>
                </Panel>

                <Panel title="Labels & payroll path" icon={<SettingsIcon size={16} className="text-purple-300" />}>
                  <div className="space-y-3">
                    <LabeledInput label="Business treasury label" value={settingsForm.treasuryLabel} onChange={(v) => setSettingsForm({ ...settingsForm, treasuryLabel: v })} />
                    <LabeledInput label="Personal reserve label" value={settingsForm.personalReserveLabel} onChange={(v) => setSettingsForm({ ...settingsForm, personalReserveLabel: v })} />
                    <LabeledInput label="Payroll label" value={settingsForm.payrollLabel} onChange={(v) => setSettingsForm({ ...settingsForm, payrollLabel: v })} />
                    <LabeledInput label="Currency" value={settingsForm.currency} onChange={(v) => setSettingsForm({ ...settingsForm, currency: v })} />
                    <div>
                      <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Payroll path (arrow separated)</label>
                      <TextInput
                        placeholder="Business LLC → Holding company → Payroll provider → Personal account"
                        value={settingsForm.payrollPath}
                        onChange={(e) => setSettingsForm({ ...settingsForm, payrollPath: e.target.value })}
                      />
                    </div>
                    <Button onClick={saveSettings} className="rounded-xl zar-gradient">Save settings</Button>
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      Labels are yours to name. Rename the treasury to anything that fits your structure.
                    </p>
                  </div>
                </Panel>

                <div className="lg:col-span-2">
                  <Panel title="Payroll path" icon={<Building2 size={16} className="text-cyan-300" />}>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {state.settings.payrollPath.map((step, i) => (
                        <span key={`${step}-${i}`} className="flex items-center gap-2">
                          <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5">{step}</span>
                          {i < state.settings.payrollPath.length - 1 && <ArrowRight size={14} className="text-muted-foreground" />}
                        </span>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function AllocationRow({ icon, label, value, pct }: { icon: React.ReactNode; label: string; value: string; pct: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
        <span className="ml-auto">{pct}%</span>
      </div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</label>
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
