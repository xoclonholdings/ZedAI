import type { ZarErrorDetail } from "../../shared/error-contract";

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
