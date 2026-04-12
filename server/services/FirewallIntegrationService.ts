import { loadAdminSettings } from "./AdminSettingsStore";

type FirewallHealthResponse = {
  system?: string;
  status?: string;
  message?: string;
  visibility?: {
    publicBaseUrl?: string;
    vpnBaseUrl?: string;
    vpnProvider?: string;
  };
  threatCounters?: Record<string, unknown>;
  zetaCore?: Record<string, unknown>;
  latestMetrics?: Record<string, unknown> | null;
  recentSecurityEvents?: unknown[];
  timestamp?: string;
};

function normalizeBaseUrl(value?: string) {
  return value?.trim().replace(/\/+$/, "") || "";
}

function normalizePath(value?: string, fallback = "/api/integration/firewall/status") {
  const next = value?.trim() || fallback;
  return next.startsWith("/") ? next : `/${next}`;
}

async function requestFirewallStatus(baseUrl: string, path: string, authToken: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${normalizePath(path)}`, {
      method: "GET",
      headers: authToken
        ? {
            Authorization: `Bearer ${authToken}`,
            "x-zeta-integration-token": authToken,
          }
        : {},
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as FirewallHealthResponse;
    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFirewallIntegrationStatus() {
  const settings = await loadAdminSettings();
  const firewall = settings.integrations.firewall;
  const vpnBaseUrl = normalizeBaseUrl(firewall.vpnBaseUrl);
  const publicBaseUrl = normalizeBaseUrl(firewall.publicBaseUrl);
  const candidates =
    firewall.preferredRoute === "public"
      ? [
          { route: "public" as const, baseUrl: publicBaseUrl, path: firewall.publicHealthPath || firewall.healthPath },
          { route: "vpn" as const, baseUrl: vpnBaseUrl, path: firewall.healthPath },
        ]
      : [
          { route: "vpn" as const, baseUrl: vpnBaseUrl, path: firewall.healthPath },
          { route: "public" as const, baseUrl: publicBaseUrl, path: firewall.publicHealthPath || firewall.healthPath },
        ];

  const configuredCandidates = candidates.filter((candidate) => candidate.baseUrl);

  if (!firewall.enabled) {
    return {
      enabled: false,
      configured: configuredCandidates.length > 0,
      status: "disabled",
      message: "Firewall integration is disabled.",
    };
  }

  if (configuredCandidates.length === 0) {
    return {
      enabled: true,
      configured: false,
      status: "misconfigured",
      message: "Configure a VPN URL or public firewall URL first.",
    };
  }

  const failures: string[] = [];

  for (const candidate of configuredCandidates) {
    try {
      const result = await requestFirewallStatus(candidate.baseUrl, candidate.path, firewall.authToken);
      if (result.ok) {
        return {
          enabled: true,
          configured: true,
          status: "connected",
          route: candidate.route,
          baseUrl: candidate.baseUrl,
          path: normalizePath(candidate.path),
          vpnProvider: firewall.vpnProvider,
          message:
            candidate.route === "vpn"
              ? "Connected to Fantasma Firewall over the VPN route."
              : "Connected to Fantasma Firewall over the public domain route.",
          firewall: result.payload,
        };
      }

      failures.push(`${candidate.route}:${result.status}`);
    } catch (error) {
      failures.push(
        `${candidate.route}:${error instanceof Error ? error.message : "request failed"}`,
      );
    }
  }

  return {
    enabled: true,
    configured: true,
    status: "unreachable",
    vpnProvider: firewall.vpnProvider,
    message: "Configured firewall routes did not respond successfully.",
    failures,
  };
}
