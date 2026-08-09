import type {
  PaperTradeManagementStyle,
  PaperTradingGovernanceMode,
  PaperTradingGovernanceSettings,
} from "../../shared/trading-types";
import { TradingStore } from "../zcos/trading/TradingStore";
import { ownerUserIdFromAuthenticatedRequest } from "../services/auth/OwnerContext";

/** Shared by every trading-* route module — kept in one place instead of duplicated per file. */

export function userIdFrom(req: any): string {
  return ownerUserIdFromAuthenticatedRequest(req);
}

export function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

export function toGovernanceMode(value: unknown): PaperTradingGovernanceMode | undefined {
  return value === "enforce" || value === "warn" || value === "off" ? value : undefined;
}

export function toManagementStyle(value: unknown): PaperTradeManagementStyle {
  return value === "stop_only" || value === "target_only" || value === "manual" ? value : "bracket";
}

export type PaperGovernanceSettingsPatch = {
  mode?: PaperTradingGovernanceMode;
  checks?: PaperTradingGovernanceSettings["checks"];
  thresholds?: Partial<PaperTradingGovernanceSettings["thresholds"]>;
};

export function requireFields(body: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return field;
    }
  }
  return null;
}

export async function findUserThesis(userId: string, thesisId?: unknown) {
  if (!thesisId) return undefined;
  const theses = await TradingStore.listTheses(userId);
  return theses.find((thesis) => thesis.id === String(thesisId));
}
