import type { ZarErrorDetail } from "../../shared/error-contract";
import type { TradingGovernanceChecklistItem } from "../../shared/trading-types";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function maskSecrets(value: string): string {
  return value
    .replace(/sk-lit[A-Za-z0-9_\-./]+/g, (match) => {
      const [key, ...suffix] = match.split("/");
      const maskedKey = key.length > 12 ? `${key.slice(0, 6)}...${key.slice(-4)}` : "sk-lit...";
      return [maskedKey, ...suffix].join("/");
    })
    .replace(/Bearer\s+[A-Za-z0-9_\-./]+/gi, "Bearer [masked]");
}

function parseLightningStatus(message: string): number | undefined {
  const match = message.match(/Lightning\s+(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

function parseLightningJson(message: string): Record<string, unknown> | null {
  const match = message.match(/\{.*\}/s);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export function classifyChatError(error: unknown, context: {
  provider?: string;
  target?: string;
} = {}): ZarErrorDetail {
  const raw = clean((error as any)?.message || error);
  const safeRaw = maskSecrets(raw || "Unknown chat execution error.");
  const lightningStatus = parseLightningStatus(safeRaw);
  const lightningBody = parseLightningJson(safeRaw);
  const lightningCode = clean(lightningBody?.code);
  const lightningMessage = clean(lightningBody?.message);

  if (/insufficient_balance/i.test(safeRaw) || lightningStatus === 402) {
    return {
      code: "AI_HOST_BILLING_REJECTED",
      userMessage: "Lightning rejected the AI request because the billing account or teamspace could not cover it.",
      exactReason: lightningMessage || safeRaw,
      action: "Verify LIGHTNING_API_KEY includes the required /organization/teamspace billing path, then restart the backend.",
      technicalDetails: {
        provider: context.provider || "lightning",
        target: context.target,
        status: lightningStatus,
        upstreamCode: lightningCode || undefined,
      },
    };
  }

  if (/not authorized|unauthorized|401/i.test(safeRaw)) {
    return {
      code: "AI_HOST_UNAUTHORIZED",
      userMessage: "Lightning rejected the AI key.",
      exactReason: safeRaw,
      action: "Check that LIGHTNING_API_KEY is the Model API key and that the key has access to the selected models.",
      technicalDetails: { provider: context.provider || "lightning", target: context.target, status: lightningStatus },
    };
  }

  if (/failed to find the model|model/i.test(safeRaw) && lightningStatus === 400) {
    return {
      code: "AI_HOST_MODEL_REJECTED",
      userMessage: "Lightning rejected the model selection.",
      exactReason: safeRaw,
      action: "Use only the approved Lightning model IDs configured for ZAR.",
      technicalDetails: { provider: context.provider || "lightning", target: context.target, status: lightningStatus },
    };
  }

  if (/fetch failed|ECONNREFUSED|ECONNRESET|timeout|timed out/i.test(safeRaw)) {
    return {
      code: "AI_HOST_NETWORK_ERROR",
      userMessage: "ZAR could not reach the AI host.",
      exactReason: safeRaw,
      action: "Check the backend network path and Lightning base URL, then retry after the service is reachable.",
      technicalDetails: { provider: context.provider || "lightning", target: context.target },
    };
  }

  return {
    code: "CHAT_EXECUTION_FAILED",
    userMessage: "ZAR could not complete the request.",
    exactReason: safeRaw,
    action: "Review the exact error and retry after correcting the failing dependency.",
    technicalDetails: { provider: context.provider, target: context.target },
  };
}

export function classifyGovernanceError(checklist: TradingGovernanceChecklistItem[] | undefined): ZarErrorDetail {
  const failures = (checklist || []).filter(
    (item) => item.critical && (item.result === "FAIL" || item.result === "UNKNOWN"),
  );
  const exact = failures.length
    ? failures
        .map((item) => `${item.label} ${item.result}: ${item.evidence}`)
        .join(" | ")
    : "No critical checklist failure details were returned by governance.";
  const missing = failures.flatMap((item) => item.missingInformation || []);
  return {
    code: "TRADE_GOVERNANCE_DENIED",
    userMessage: "ZAR could not approve this paper trade because governance checks failed.",
    exactReason: exact,
    action: missing.length
      ? `Provide or correct: ${Array.from(new Set(missing)).join(", ")}.`
      : "Open the governance decision details and correct the failed checklist item.",
    technicalDetails: {
      failedChecks: failures.map((item) => ({
        key: item.key,
        label: item.label,
        result: item.result,
        critical: item.critical,
        evidence: item.evidence,
        missingInformation: item.missingInformation,
      })),
    },
  };
}
