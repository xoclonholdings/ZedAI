/**
 * Budget Management model — the Dual Reserve Strategy.
 *
 * Every incoming dollar should strengthen either the founder or the
 * company, ideally both over time. The flow manages two parallel
 * reserves: a Personal Reserve (savings, emergency fund, retirement
 * later) and a Business Treasury (operating cash, growth, and — only
 * once thresholds are met — future liquidity, buybacks, and strategic
 * investments).
 *
 * This model is intentionally universal. The business reserve is a
 * generic "Business Treasury" with a configurable label, so any
 * operator can adopt the flow. Nothing here is hardcoded to a single
 * company. Labels, the payroll path, and currency live in
 * BudgetSettings and can be renamed per user.
 *
 * The pure functions (allocateDeposit, resolveTreasuryStage,
 * treasuryReadinessMessage, buildDepositRecommendation) live here so
 * the client preview, the server routes, and the Finance agent all
 * share one source of truth and never diverge.
 */

export type IncomeSource = "employer" | "doordash" | "instacart" | "manual" | "other";

export interface AllocationRule {
  savingsPercent: number;
  taxPercent: number;
  payrollPercent: number;
  treasuryPercent: number;
}

export interface AllocationBreakdown {
  savings: number;
  taxes: number;
  payroll: number;
  treasury: number;
  total: number;
}

export interface DepositEntry {
  id: string;
  createdAt: string;
  userId: string;
  amount: number;
  source: IncomeSource;
  sourceLabel?: string;
  note?: string;
  allocation: AllocationBreakdown;
  ruleSnapshot: AllocationRule;
  appliedToBalances: boolean;
}

export type TreasuryStageId = "build" | "liquidity_prep" | "liquidity_eligible";

export interface TreasuryStageDefinition {
  id: TreasuryStageId;
  order: number;
  label: string;
  min: number;
  max: number | null;
  recommendation: string;
  guardrails: string[];
}

export interface ReserveTargets {
  savingsTarget: number;
  emergencyFundTarget: number;
  operatingReserveTarget: number;
  retirementNote: string;
}

export interface ReserveBalances {
  savingsBalance: number;
  emergencyFundBalance: number;
  treasuryBalance: number;
}

export interface BudgetSettings {
  /** Generic by default so the flow is universal. Rename to e.g. "ZWAP Treasury". */
  treasuryLabel: string;
  personalReserveLabel: string;
  payrollLabel: string;
  /** Ordered representation of the payroll path, e.g. LLC → Holdings → Gusto → personal. */
  payrollPath: string[];
  currency: string;
}

export interface BudgetState {
  userId: string;
  rule: AllocationRule;
  targets: ReserveTargets;
  balances: ReserveBalances;
  settings: BudgetSettings;
  lastAllocation?: {
    amount: number;
    source: IncomeSource;
    at: string;
    breakdown: AllocationBreakdown;
  };
  lastUpdated: string;
}

export interface TreasuryReadiness {
  stage: TreasuryStageDefinition;
  liquidityReady: boolean;
  buybackReady: boolean;
  investmentReady: boolean;
  excessCapital: number;
  nextMilestoneLabel: string;
  amountToNextMilestone: number;
  message: string;
}

export interface BudgetReport {
  generatedAt: string;
  depositCount: number;
  totalIncome: number;
  totalSaved: number;
  totalReservedForTaxes: number;
  totalSentToPayroll: number;
  totalRetainedByTreasury: number;
  treasuryStage: TreasuryStageId;
  treasuryStageLabel: string;
  nextMilestoneLabel: string;
  amountToNextMilestone: number;
  bySource: Array<{ source: IncomeSource; count: number; income: number }>;
}

export const DEFAULT_ALLOCATION_RULE: AllocationRule = {
  savingsPercent: 10,
  taxPercent: 15,
  payrollPercent: 50,
  treasuryPercent: 25,
};

export const DEFAULT_RESERVE_TARGETS: ReserveTargets = {
  savingsTarget: 5000,
  emergencyFundTarget: 5000,
  operatingReserveTarget: 5000,
  retirementNote:
    "Route long-term savings toward retirement/investing once the emergency fund is covered.",
};

export const DEFAULT_RESERVE_BALANCES: ReserveBalances = {
  savingsBalance: 0,
  emergencyFundBalance: 0,
  treasuryBalance: 0,
};

export const DEFAULT_BUDGET_SETTINGS: BudgetSettings = {
  treasuryLabel: "Business Treasury",
  personalReserveLabel: "Personal Reserve",
  payrollLabel: "Personal Payroll",
  payrollPath: ["Business LLC", "Holding company", "Payroll provider", "Personal account"],
  currency: "USD",
};

/**
 * Treasury readiness milestones. The system deliberately does NOT
 * recommend liquidity seeding immediately — it builds the reserve
 * first, then prepares a policy, and only treats capital ABOVE the
 * operating reserve as eligible for liquidity, buybacks, or strategic
 * investments.
 */
export const TREASURY_STAGES: TreasuryStageDefinition[] = [
  {
    id: "build",
    order: 1,
    label: "Treasury Build Phase",
    min: 0,
    max: 5000,
    recommendation: "Build the reserve. Do not seed liquidity yet.",
    guardrails: [
      "Keep every treasury dollar as operating cash and runway.",
      "No liquidity, buybacks, or strategic deployments at this stage.",
    ],
  },
  {
    id: "liquidity_prep",
    order: 2,
    label: "Liquidity Prep Phase",
    min: 5000,
    max: 10000,
    recommendation: "Prepare a written treasury policy before deploying any funds.",
    guardrails: [
      "Document a treasury policy: reserve floor, what counts as excess, and approval rules.",
      "Still hold — capital is being staged, not deployed.",
    ],
  },
  {
    id: "liquidity_eligible",
    order: 3,
    label: "Liquidity Eligible Phase",
    min: 10000,
    max: null,
    recommendation:
      "Only capital above your operating reserve may be considered for liquidity, buybacks, or strategic investments.",
    guardrails: [
      "Protect the operating reserve first — only excess is eligible.",
      "Nothing executes automatically. This flow recommends; it never trades or moves money.",
    ],
  },
];

export const DEFAULT_BUDGET_STATE: Omit<BudgetState, "userId" | "lastUpdated"> = {
  rule: DEFAULT_ALLOCATION_RULE,
  targets: DEFAULT_RESERVE_TARGETS,
  balances: DEFAULT_RESERVE_BALANCES,
  settings: DEFAULT_BUDGET_SETTINGS,
};

export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  employer: "Employer paycheck",
  doordash: "DoorDash",
  instacart: "Instacart",
  manual: "Manual income",
  other: "Other",
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function allocationRuleTotal(rule: AllocationRule): number {
  return rule.savingsPercent + rule.taxPercent + rule.payrollPercent + rule.treasuryPercent;
}

export function isValidAllocationRule(rule: AllocationRule): boolean {
  const parts = [rule.savingsPercent, rule.taxPercent, rule.payrollPercent, rule.treasuryPercent];
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return false;
  return Math.abs(allocationRuleTotal(rule) - 100) < 0.001;
}

/**
 * Split a deposit into the four buckets. Savings, taxes, and payroll
 * are rounded to cents; the treasury bucket absorbs the rounding
 * remainder so the four parts always sum back to the exact deposit.
 */
export function allocateDeposit(amount: number, rule: AllocationRule): AllocationBreakdown {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const savings = roundMoney((safeAmount * rule.savingsPercent) / 100);
  const taxes = roundMoney((safeAmount * rule.taxPercent) / 100);
  const payroll = roundMoney((safeAmount * rule.payrollPercent) / 100);
  const treasury = roundMoney(safeAmount - savings - taxes - payroll);
  return { savings, taxes, payroll, treasury, total: roundMoney(safeAmount) };
}

export function resolveTreasuryStage(treasuryBalance: number): TreasuryStageDefinition {
  const stage = TREASURY_STAGES.find(
    (s) => treasuryBalance >= s.min && (s.max === null || treasuryBalance < s.max),
  );
  return stage || TREASURY_STAGES[TREASURY_STAGES.length - 1];
}

export function evaluateTreasuryReadiness(
  treasuryBalance: number,
  operatingReserveTarget: number,
): TreasuryReadiness {
  const stage = resolveTreasuryStage(treasuryBalance);
  const reserveMet = treasuryBalance >= operatingReserveTarget;
  const eligible = stage.id === "liquidity_eligible" && reserveMet;
  const excessCapital = eligible ? roundMoney(treasuryBalance - operatingReserveTarget) : 0;

  const nextStage = TREASURY_STAGES.find((s) => s.order === stage.order + 1);
  const nextThreshold = stage.max ?? operatingReserveTarget;
  const amountToNextMilestone = nextStage
    ? roundMoney(Math.max(nextThreshold - treasuryBalance, 0))
    : reserveMet
      ? 0
      : roundMoney(Math.max(operatingReserveTarget - treasuryBalance, 0));
  const nextMilestoneLabel = nextStage
    ? nextStage.label
    : reserveMet
      ? "Operating reserve covered"
      : "Cover the operating reserve";

  let message: string;
  if (eligible) {
    message = `Treasury is above your operating reserve. Only the ${formatCurrency(
      excessCapital,
    )} of excess capital may be considered for liquidity, buybacks, or strategic investments — the reserve stays protected.`;
  } else if (stage.id === "liquidity_eligible") {
    message = `Treasury has crossed ${formatCurrency(
      stage.min,
    )}, but it is still at or below your operating reserve. Liquidity is not ready yet — protect the reserve first.`;
  } else if (stage.id === "liquidity_prep") {
    message = `Liquidity is not ready yet. Treasury is in the prep phase — write the treasury policy before any funds are deployed. About ${formatCurrency(
      amountToNextMilestone,
    )} to reach the liquidity-eligible threshold.`;
  } else {
    message = `Liquidity is not ready yet because treasury is still below the reserve threshold. Keep building — about ${formatCurrency(
      amountToNextMilestone,
    )} to reach the next milestone. This amount should stay in the treasury for now.`;
  }

  return {
    stage,
    liquidityReady: eligible,
    buybackReady: eligible,
    investmentReady: eligible,
    excessCapital,
    nextMilestoneLabel,
    amountToNextMilestone,
    message,
  };
}

export function formatCurrency(value: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
  }
}

/**
 * Natural, operator-style language for a single deposit. No robotic
 * "Confidence Level" / "Evidence" labels — just the clean move.
 */
export function buildDepositRecommendation(input: {
  amount: number;
  breakdown: AllocationBreakdown;
  readiness: TreasuryReadiness;
  settings: BudgetSettings;
}): string {
  const { breakdown, readiness, settings } = input;
  const c = settings.currency;
  const lines = [
    `Here's the clean move on ${formatCurrency(breakdown.total, c)}:`,
    `- ${formatCurrency(breakdown.savings, c)} to ${settings.personalReserveLabel} (savings)`,
    `- ${formatCurrency(breakdown.taxes, c)} held for taxes`,
    `- ${formatCurrency(breakdown.payroll, c)} to ${settings.payrollLabel}`,
    `- ${formatCurrency(breakdown.treasury, c)} to ${settings.treasuryLabel}`,
    "",
    "This deposit strengthens both sides — the founder and the company.",
    readiness.message,
  ];
  return lines.join("\n");
}
