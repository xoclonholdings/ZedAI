/**
 * UrlSafetyGuard
 *
 * SSRF protection shared by every capability that fetches a URL the user
 * did not run themselves — direct webpage fetch, bounded crawling, and
 * (later) browser automation navigation. Nothing in ZAR should call
 * `fetch()` on a user- or model-supplied URL without going through this
 * first.
 *
 * Blocks:
 *   - non-http(s) schemes
 *   - literal loopback / private / link-local / CGNAT / reserved /
 *     multicast IPv4 and IPv6 addresses
 *   - the cloud metadata endpoint (169.254.169.254 and the IPv6
 *     equivalent fd00:ec2::254)
 *   - hostnames that resolve (via DNS) to any of the above — this is the
 *     "look up the hostname, then validate every A/AAAA record" defense
 *     against DNS-rebinding style bypasses
 *   - URLs carrying userinfo (http://user:pass@host/) as a defense
 *     against credential-smuggling / auth-bypass tricks
 *
 * `followRedirectsSafely` re-validates every redirect hop before
 * following it, so a safe URL that 302s to an internal address is
 * caught rather than silently followed.
 */

import dns from "node:dns";

export type DnsResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
  resolvedAddresses?: string[];
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function ipv4ToInt(parts: number[]): number {
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr4(ip: number, base: string, prefix: number): boolean {
  const baseParts = base.split(".").map(Number);
  const baseInt = ipv4ToInt(baseParts);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ip & mask) === (baseInt & mask);
}

const IPV4_PRIVATE_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // RFC1918
  ["100.64.0.0", 10], // CGNAT (RFC6598)
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, includes the cloud metadata IP
  ["172.16.0.0", 12], // RFC1918
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.168.0.0", 16], // RFC1918
  ["198.18.0.0", 15], // benchmark
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
];

function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const ip = ipv4ToInt(parts);
  return IPV4_PRIVATE_RANGES.some(([base, prefix]) => inCidr4(ip, base, prefix));
}

function isPrivateIPv6(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded IPv4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  // Unique local (fc00::/7) and link-local (fe80::/10), including the
  // AWS/GCP/Azure metadata IPv6 address fd00:ec2::254.
  if (/^f[c-f][0-9a-f]{2}:/.test(lower)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  // Multicast
  if (lower.startsWith("ff")) return true;
  return false;
}

export function isPrivateAddress(address: string, family: number): boolean {
  return family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address);
}

/** Literal-IP hostnames (both dotted-decimal and bracketed IPv6). */
function literalIpFamily(hostname: string): number | null {
  const bare = hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return 4;
  if (bare.includes(":")) return 6;
  return null;
}

let resolver: DnsResolver = async (hostname: string) => {
  const results = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return results.map((r) => ({ address: r.address, family: r.family }));
};

/** Test-only hook to inject a fake resolver instead of doing real DNS. */
export function __setDnsResolverForTest(fn: DnsResolver | null): void {
  resolver = fn || (async (hostname: string) => {
    const results = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    return results.map((r) => ({ address: r.address, family: r.family }));
  });
}

export async function checkUrlSafety(rawUrl: string): Promise<UrlSafetyResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "not_a_valid_url" };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { safe: false, reason: `scheme_not_allowed:${parsed.protocol}` };
  }
  if (parsed.username || parsed.password) {
    return { safe: false, reason: "userinfo_not_allowed" };
  }

  const hostname = parsed.hostname;
  if (!hostname) return { safe: false, reason: "missing_hostname" };
  if (hostname.toLowerCase() === "localhost" || hostname.toLowerCase().endsWith(".localhost")) {
    return { safe: false, reason: "localhost_blocked" };
  }

  const literalFamily = literalIpFamily(hostname);
  if (literalFamily) {
    const bare = hostname.replace(/^\[/, "").replace(/\]$/, "");
    if (isPrivateAddress(bare, literalFamily)) {
      // Loopback-only escape hatch so tests can run local fixture servers.
      // Never enable in production.
      if (process.env.WEB_ALLOW_LOOPBACK_FOR_TESTS === "true" && bare === "127.0.0.1") {
        return { safe: true, resolvedAddresses: [bare] };
      }
      return { safe: false, reason: "private_ip_literal", resolvedAddresses: [bare] };
    }
    return { safe: true, resolvedAddresses: [bare] };
  }

  try {
    const records = await resolver(hostname);
    if (records.length === 0) return { safe: false, reason: "dns_no_records" };
    const addresses = records.map((r) => r.address);
    const blocked = records.find((r) => isPrivateAddress(r.address, r.family));
    if (blocked) {
      return { safe: false, reason: "resolves_to_private_ip", resolvedAddresses: addresses };
    }
    return { safe: true, resolvedAddresses: addresses };
  } catch (err: any) {
    return { safe: false, reason: `dns_lookup_failed:${err?.message || String(err)}` };
  }
}

export interface SafeFetchOptions extends Omit<RequestInit, "signal"> {
  maxRedirects?: number;
  timeoutMs?: number;
  /** External cancellation signal, e.g. from a cancellable research/crawl job. */
  signal?: AbortSignal;
}

export class UnsafeUrlError extends Error {
  constructor(public readonly url: string, public readonly reason: string) {
    super(`Blocked unsafe URL (${reason}): ${url}`);
    this.name = "UnsafeUrlError";
  }
}

/**
 * fetch() that validates the target (and every redirect hop) against
 * checkUrlSafety before connecting. Never follows the platform's
 * automatic redirect handling — every hop is inspected first.
 */
export async function safeFetch(inputUrl: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { maxRedirects = 5, timeoutMs = 12_000, signal: externalSignal, ...init } = options;
  let currentUrl = inputUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (externalSignal?.aborted) throw new Error("aborted");
    const safety = await checkUrlSafety(currentUrl);
    if (!safety.safe) {
      throw new UnsafeUrlError(currentUrl, safety.reason || "unknown");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onExternalAbort);
    let res: Response;
    try {
      res = await fetch(currentUrl, { ...init, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return res;
  }

  throw new UnsafeUrlError(currentUrl, "too_many_redirects");
}
