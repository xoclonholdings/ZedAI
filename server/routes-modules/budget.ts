import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { BudgetStore } from "../services/budget/BudgetStore";
import { ownerUserIdFromAuthenticatedRequest } from "../services/auth/OwnerContext";
import {
  TREASURY_STAGES,
  allocateDeposit,
  buildDepositRecommendation,
  evaluateTreasuryReadiness,
  isValidAllocationRule,
  type AllocationRule,
  type IncomeSource,
} from "../../shared/budget-types";

/**
 * Budget Management flow — the Dual Reserve Strategy.
 *
 * These endpoints organize income allocation. They are planning
 * logic only. Nothing here executes trades, buys tokens, seeds
 * liquidity, triggers buybacks, or transfers money externally.
 */

const INCOME_SOURCES: IncomeSource[] = ["employer", "doordash", "instacart", "manual", "other"];

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSource(value: unknown): IncomeSource {
  const candidate = String(value || "").toLowerCase() as IncomeSource;
  return INCOME_SOURCES.includes(candidate) ? candidate : "manual";
}

function ruleFromBody(body: any): AllocationRule {
  return {
    savingsPercent: toNumber(body?.savingsPercent),
    taxPercent: toNumber(body?.taxPercent),
    payrollPercent: toNumber(body?.payrollPercent),
    treasuryPercent: toNumber(body?.treasuryPercent),
  };
}

export function registerBudgetRoutes(app: Express): void {
  app.get("/api/budget/state", isAuthenticated, async (req: any, res) => {
    const state = await BudgetStore.loadState(ownerUserIdFromAuthenticatedRequest(req));
    const readiness = evaluateTreasuryReadiness(
      state.balances.treasuryBalance,
      state.targets.operatingReserveTarget,
    );
    res.json({ state, stages: TREASURY_STAGES, readiness });
  });

  /**
   * Preview a deposit allocation without persisting anything. Used by
   * the calculator and the Finance agent for a clean, instant answer.
   */
  app.post("/api/budget/allocate", isAuthenticated, async (req: any, res) => {
    const amount = toNumber(req.body?.amount);
    if (amount <= 0) return res.status(400).json({ error: "amount must be greater than 0" });

    const state = await BudgetStore.loadState(ownerUserIdFromAuthenticatedRequest(req));
    const breakdown = allocateDeposit(amount, state.rule);
    const readiness = evaluateTreasuryReadiness(
      state.balances.treasuryBalance,
      state.targets.operatingReserveTarget,
    );
    const recommendation = buildDepositRecommendation({
      amount,
      breakdown,
      readiness,
      settings: state.settings,
    });
    res.json({ allocation: breakdown, readiness, recommendation });
  });

  app.get("/api/budget/deposits", isAuthenticated, async (req: any, res) => {
    const deposits = await BudgetStore.listDeposits(ownerUserIdFromAuthenticatedRequest(req));
    res.json({ deposits });
  });

  app.post("/api/budget/deposits", isAuthenticated, async (req: any, res) => {
    const amount = toNumber(req.body?.amount);
    if (amount <= 0) return res.status(400).json({ error: "amount must be greater than 0" });

    const { deposit, state } = await BudgetStore.recordDeposit({
      userId: ownerUserIdFromAuthenticatedRequest(req),
      amount,
      source: normalizeSource(req.body?.source),
      sourceLabel: req.body?.sourceLabel ? String(req.body.sourceLabel) : undefined,
      note: req.body?.note ? String(req.body.note) : undefined,
      applyToBalances: req.body?.applyToBalances !== false,
    });
    const readiness = evaluateTreasuryReadiness(
      state.balances.treasuryBalance,
      state.targets.operatingReserveTarget,
    );
    res.json({ deposit, state, readiness });
  });

  app.patch("/api/budget/rule", isAuthenticated, async (req: any, res) => {
    const rule = ruleFromBody(req.body || {});
    if (!isValidAllocationRule(rule)) {
      return res
        .status(400)
        .json({ error: "Allocation percentages must be non-negative and total exactly 100." });
    }
    const state = await BudgetStore.updateRule(ownerUserIdFromAuthenticatedRequest(req), rule);
    res.json({ state });
  });

  app.patch("/api/budget/targets", isAuthenticated, async (req: any, res) => {
    const body = req.body || {};
    const patch: Record<string, unknown> = {};
    if (body.savingsTarget !== undefined) patch.savingsTarget = toNumber(body.savingsTarget);
    if (body.emergencyFundTarget !== undefined) patch.emergencyFundTarget = toNumber(body.emergencyFundTarget);
    if (body.operatingReserveTarget !== undefined) patch.operatingReserveTarget = toNumber(body.operatingReserveTarget);
    if (typeof body.retirementNote === "string") patch.retirementNote = body.retirementNote;
    const state = await BudgetStore.updateTargets(ownerUserIdFromAuthenticatedRequest(req), patch);
    res.json({ state });
  });

  app.patch("/api/budget/balances", isAuthenticated, async (req: any, res) => {
    const body = req.body || {};
    const patch: Record<string, unknown> = {};
    if (body.savingsBalance !== undefined) patch.savingsBalance = toNumber(body.savingsBalance);
    if (body.emergencyFundBalance !== undefined) patch.emergencyFundBalance = toNumber(body.emergencyFundBalance);
    if (body.treasuryBalance !== undefined) patch.treasuryBalance = toNumber(body.treasuryBalance);
    const state = await BudgetStore.updateBalances(ownerUserIdFromAuthenticatedRequest(req), patch);
    const readiness = evaluateTreasuryReadiness(
      state.balances.treasuryBalance,
      state.targets.operatingReserveTarget,
    );
    res.json({ state, readiness });
  });

  app.patch("/api/budget/settings", isAuthenticated, async (req: any, res) => {
    const body = req.body || {};
    const patch: Record<string, unknown> = {};
    if (typeof body.treasuryLabel === "string") patch.treasuryLabel = body.treasuryLabel;
    if (typeof body.personalReserveLabel === "string") patch.personalReserveLabel = body.personalReserveLabel;
    if (typeof body.payrollLabel === "string") patch.payrollLabel = body.payrollLabel;
    if (typeof body.currency === "string") patch.currency = body.currency;
    if (Array.isArray(body.payrollPath)) {
      patch.payrollPath = body.payrollPath.map((step: unknown) => String(step)).filter(Boolean);
    }
    const state = await BudgetStore.updateSettings(ownerUserIdFromAuthenticatedRequest(req), patch);
    res.json({ state });
  });

  app.get("/api/budget/report", isAuthenticated, async (req: any, res) => {
    const report = await BudgetStore.buildReport(ownerUserIdFromAuthenticatedRequest(req));
    res.json({ report });
  });
}
