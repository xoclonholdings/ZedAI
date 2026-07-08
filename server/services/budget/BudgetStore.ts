import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { HUB_DIR, HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import {
  DEFAULT_BUDGET_STATE,
  allocateDeposit,
  evaluateTreasuryReadiness,
  isValidAllocationRule,
  resolveTreasuryStage,
  type AllocationRule,
  type BudgetReport,
  type BudgetSettings,
  type BudgetState,
  type DepositEntry,
  type IncomeSource,
  type ReserveBalances,
  type ReserveTargets,
} from "../../../shared/budget-types";

/**
 * Persists the Budget Management flow per user.
 *
 * Storage layout mirrors the trading stores:
 *   hub/budget/state/<userId>.json      — rule, targets, balances, settings
 *   hub/budget/deposits/<userId>.json   — deposit log (allocation history)
 *
 * The store holds state only. All allocation math, treasury
 * milestones, and recommendation language live in
 * shared/budget-types.ts so the client, server, and Finance agent
 * never diverge.
 */

const BUDGET_DIR = path.resolve(HUB_DIR, "budget");
const STATE_DIR = path.resolve(BUDGET_DIR, "state");
const DEPOSITS_DIR = path.resolve(BUDGET_DIR, "deposits");
const BUDGET_MEMORY_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "working", "budget-management.md");

function safeId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function stateFile(userId: string): string {
  return path.resolve(STATE_DIR, `${safeId(userId)}.json`);
}

function depositsFile(userId: string): string {
  return path.resolve(DEPOSITS_DIR, `${safeId(userId)}.json`);
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(DEPOSITS_DIR, { recursive: true });
  await fs.mkdir(path.dirname(BUDGET_MEMORY_PATH), { recursive: true });
}

function now(): string {
  return new Date().toISOString();
}

async function readDeposits(userId: string): Promise<DepositEntry[]> {
  try {
    const raw = await fs.readFile(depositsFile(userId), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DepositEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeDeposits(userId: string, deposits: DepositEntry[]): Promise<void> {
  await ensureDirs();
  await fs.writeFile(depositsFile(userId), JSON.stringify(deposits, null, 2), "utf-8");
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const BudgetStore = {
  async loadState(userId: string): Promise<BudgetState> {
    try {
      const raw = await fs.readFile(stateFile(userId), "utf-8");
      const parsed = JSON.parse(raw) as Partial<BudgetState>;
      return {
        userId,
        rule: { ...DEFAULT_BUDGET_STATE.rule, ...(parsed.rule || {}) },
        targets: { ...DEFAULT_BUDGET_STATE.targets, ...(parsed.targets || {}) },
        balances: { ...DEFAULT_BUDGET_STATE.balances, ...(parsed.balances || {}) },
        settings: { ...DEFAULT_BUDGET_STATE.settings, ...(parsed.settings || {}) },
        lastAllocation: parsed.lastAllocation,
        lastUpdated: parsed.lastUpdated || now(),
      };
    } catch {
      return { userId, ...DEFAULT_BUDGET_STATE, lastUpdated: now() };
    }
  },

  async saveState(state: BudgetState): Promise<BudgetState> {
    await ensureDirs();
    const next: BudgetState = { ...state, lastUpdated: now() };
    await fs.writeFile(stateFile(state.userId), JSON.stringify(next, null, 2), "utf-8");
    return next;
  },

  async updateRule(userId: string, rule: AllocationRule): Promise<BudgetState> {
    if (!isValidAllocationRule(rule)) {
      throw new Error("Allocation percentages must be non-negative and total exactly 100.");
    }
    const state = await this.loadState(userId);
    const next = await this.saveState({ ...state, rule });
    await this.appendMemory(
      `Allocation rule updated: ${rule.savingsPercent}% savings / ${rule.taxPercent}% taxes / ${rule.payrollPercent}% payroll / ${rule.treasuryPercent}% treasury.`,
    );
    return next;
  },

  async updateTargets(userId: string, patch: Partial<ReserveTargets>): Promise<BudgetState> {
    const state = await this.loadState(userId);
    return this.saveState({ ...state, targets: { ...state.targets, ...patch } });
  },

  async updateBalances(userId: string, patch: Partial<ReserveBalances>): Promise<BudgetState> {
    const state = await this.loadState(userId);
    return this.saveState({ ...state, balances: { ...state.balances, ...patch } });
  },

  async updateSettings(userId: string, patch: Partial<BudgetSettings>): Promise<BudgetState> {
    const state = await this.loadState(userId);
    return this.saveState({ ...state, settings: { ...state.settings, ...patch } });
  },

  async listDeposits(userId: string): Promise<DepositEntry[]> {
    const deposits = await readDeposits(userId);
    return deposits.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  /**
   * Record a deposit. Persists the allocation snapshot and, when
   * requested, moves the savings + treasury shares into the tracked
   * reserve balances. Taxes and payroll are pass-through obligations,
   * not reserves, so they are logged but not added to balances.
   */
  async recordDeposit(input: {
    userId: string;
    amount: number;
    source: IncomeSource;
    sourceLabel?: string;
    note?: string;
    applyToBalances?: boolean;
  }): Promise<{ deposit: DepositEntry; state: BudgetState }> {
    const state = await this.loadState(input.userId);
    const breakdown = allocateDeposit(input.amount, state.rule);
    const applyToBalances = input.applyToBalances !== false;

    const deposit: DepositEntry = {
      id: randomUUID(),
      createdAt: now(),
      userId: input.userId,
      amount: roundMoney(input.amount),
      source: input.source,
      sourceLabel: input.sourceLabel,
      note: input.note,
      allocation: breakdown,
      ruleSnapshot: state.rule,
      appliedToBalances: applyToBalances,
    };

    const deposits = await readDeposits(input.userId);
    await writeDeposits(input.userId, [deposit, ...deposits]);

    const nextBalances: ReserveBalances = applyToBalances
      ? {
          ...state.balances,
          savingsBalance: roundMoney(state.balances.savingsBalance + breakdown.savings),
          treasuryBalance: roundMoney(state.balances.treasuryBalance + breakdown.treasury),
        }
      : state.balances;

    const nextState = await this.saveState({
      ...state,
      balances: nextBalances,
      lastAllocation: {
        amount: deposit.amount,
        source: deposit.source,
        at: deposit.createdAt,
        breakdown,
      },
    });

    await this.appendMemory(
      `Deposit allocated (${input.source}): ${breakdown.total} -> savings ${breakdown.savings}, taxes ${breakdown.taxes}, payroll ${breakdown.payroll}, treasury ${breakdown.treasury}.`,
    );

    return { deposit, state: nextState };
  },

  async buildReport(userId: string): Promise<BudgetReport> {
    const state = await this.loadState(userId);
    const deposits = await readDeposits(userId);

    const totals = deposits.reduce(
      (acc, d) => {
        acc.income += d.amount;
        acc.saved += d.allocation.savings;
        acc.taxes += d.allocation.taxes;
        acc.payroll += d.allocation.payroll;
        acc.treasury += d.allocation.treasury;
        return acc;
      },
      { income: 0, saved: 0, taxes: 0, payroll: 0, treasury: 0 },
    );

    const bySourceMap = new Map<IncomeSource, { count: number; income: number }>();
    for (const d of deposits) {
      const entry = bySourceMap.get(d.source) || { count: 0, income: 0 };
      entry.count += 1;
      entry.income = roundMoney(entry.income + d.amount);
      bySourceMap.set(d.source, entry);
    }

    const readiness = evaluateTreasuryReadiness(
      state.balances.treasuryBalance,
      state.targets.operatingReserveTarget,
    );
    const stage = resolveTreasuryStage(state.balances.treasuryBalance);

    return {
      generatedAt: now(),
      depositCount: deposits.length,
      totalIncome: roundMoney(totals.income),
      totalSaved: roundMoney(totals.saved),
      totalReservedForTaxes: roundMoney(totals.taxes),
      totalSentToPayroll: roundMoney(totals.payroll),
      totalRetainedByTreasury: roundMoney(totals.treasury),
      treasuryStage: stage.id,
      treasuryStageLabel: stage.label,
      nextMilestoneLabel: readiness.nextMilestoneLabel,
      amountToNextMilestone: readiness.amountToNextMilestone,
      bySource: Array.from(bySourceMap.entries()).map(([source, stats]) => ({
        source,
        count: stats.count,
        income: stats.income,
      })),
    };
  },

  async appendMemory(summary: string): Promise<void> {
    try {
      await ensureDirs();
      await fs.appendFile(BUDGET_MEMORY_PATH, `\n- ${now()}: ${summary}`, "utf-8");
    } catch {
      /* memory logging is best-effort */
    }
  },
};
