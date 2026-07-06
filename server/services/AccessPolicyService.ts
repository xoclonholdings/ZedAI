import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

import { HUB_CONFIG_DIR } from "../utils/repoPaths";
import { logSecurityEvent } from "./SecurityAudit";

/**
 * Enforcement layer for hub/config/access.yaml. The yaml has always
 * been loaded (see manager-agent/config.ts) but nothing at runtime
 * ever consulted it — so its "no_paid_apis" policy, its approved
 * free-tier whitelist, and its trust_model were all decorative.
 *
 * This service gives the yaml teeth:
 *   - Any code reaching for an external API asks isServiceApproved
 *     first. A denial is audit-logged; an approval is audit-logged
 *     with the outcome. Nothing calls out to a paid third-party
 *     provider silently anymore.
 *   - getTrustModel exposes the single-admin vs multi-user state so
 *     admin surfaces don't have to hardcode it.
 *   - The policy is cached; flushAccessPolicy() invalidates the
 *     cache when the yaml is edited via the ruleset editor.
 *
 * Non-goals for this pass:
 *   - Blocking arbitrary URL fetches. access.yaml doesn't forbid
 *     them; it only lists whitelisted providers. Arbitrary fetches
 *     still happen, and we log them as an audit signal, but we
 *     don't refuse them here.
 *   - Rewriting repoPaths. The yaml documents the on-disk layout
 *     that repoPaths already resolves — they agree today.
 */

const ACCESS_YAML = path.join(HUB_CONFIG_DIR, "access.yaml");

export type ExternalApiCategory = "search" | "github" | "firewall";

export interface ApprovedServiceEntry {
  name: string;
  envKey: string;
  status: string;
  permissions?: string;
  category: ExternalApiCategory;
}

export interface AccessPolicy {
  externalApiPolicy: string;
  approvedServices: Record<string, ApprovedServiceEntry>;
  trustModel: {
    mode: string;
    multiUserReady: boolean;
    multiUserStub?: string;
  };
  paths: Record<string, string>;
  raw: any;
}

export type ServiceDecision =
  | { allowed: true; status: "configured" | "optional_not_configured"; entry: ApprovedServiceEntry }
  | { allowed: false; reason: "not_in_whitelist" | "not_configured"; requestedName: string };

let cached: AccessPolicy | null = null;

const DEFAULT_POLICY: AccessPolicy = {
  externalApiPolicy: "no_paid_apis",
  approvedServices: {},
  trustModel: { mode: "single_admin", multiUserReady: false },
  paths: {},
  raw: {},
};

function normalizeCategory(section: string): ExternalApiCategory | null {
  if (section === "search" || section === "github" || section === "firewall") return section;
  return null;
}

export async function loadAccessPolicy(): Promise<AccessPolicy> {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(ACCESS_YAML, "utf-8");
    const parsed = yaml.load(raw) as any;

    const approvedServices: Record<string, ApprovedServiceEntry> = {};
    const approvedFreeTier = parsed?.external_apis?.approved_free_tier || {};
    for (const [section, entries] of Object.entries(approvedFreeTier)) {
      const category = normalizeCategory(section);
      if (!category || !Array.isArray(entries)) continue;
      for (const entry of entries as any[]) {
        if (!entry?.name) continue;
        approvedServices[entry.name] = {
          name: entry.name,
          envKey: entry.env_key || "",
          status: entry.status || "unknown",
          permissions: entry.permissions,
          category,
        };
      }
    }

    cached = {
      externalApiPolicy: parsed?.external_apis?.policy || DEFAULT_POLICY.externalApiPolicy,
      approvedServices,
      trustModel: {
        mode: parsed?.trust_model?.current_mode || DEFAULT_POLICY.trustModel.mode,
        multiUserReady: !!parsed?.trust_model?.multi_user_ready,
        multiUserStub: parsed?.trust_model?.multi_user_stub,
      },
      paths: parsed?.paths || {},
      raw: parsed,
    };
  } catch (err) {
    console.warn("[AccessPolicy] Failed to load access.yaml; using safe defaults:", err);
    cached = DEFAULT_POLICY;
  }
  return cached;
}

export function flushAccessPolicy(): void {
  cached = null;
}

/**
 * Consult the policy for a specific approved-free-tier service by
 * its access.yaml name (e.g. "brave_search", "serper",
 * "github_readonly"). Emits an audit event either way so operators
 * can see the policy was actually consulted at the call site.
 */
export async function consultExternalService(
  serviceName: string,
  detail?: string,
): Promise<ServiceDecision> {
  const policy = await loadAccessPolicy();
  const entry = policy.approvedServices[serviceName];

  if (!entry) {
    await logSecurityEvent({
      type: "policy.external_api.denied",
      detail: `Not in access.yaml whitelist: ${serviceName}${detail ? ` — ${detail}` : ""}`,
    });
    return { allowed: false, reason: "not_in_whitelist", requestedName: serviceName };
  }

  const envValue = entry.envKey ? (process.env[entry.envKey] || "").trim() : "";
  const configured = envValue.length > 0;
  const decision: ServiceDecision = {
    allowed: true,
    status: configured ? "configured" : "optional_not_configured",
    entry,
  };

  await logSecurityEvent({
    type: "policy.external_api.consulted",
    detail: `${serviceName} → ${decision.status}${detail ? ` — ${detail}` : ""}`,
  });

  return decision;
}

export async function getEffectivePolicy(): Promise<{
  externalApiPolicy: string;
  services: Array<
    ApprovedServiceEntry & { configured: boolean }
  >;
  trustModel: AccessPolicy["trustModel"];
}> {
  const policy = await loadAccessPolicy();
  const services = Object.values(policy.approvedServices).map((entry) => ({
    ...entry,
    configured: entry.envKey ? (process.env[entry.envKey] || "").trim().length > 0 : false,
  }));
  return {
    externalApiPolicy: policy.externalApiPolicy,
    services,
    trustModel: policy.trustModel,
  };
}
