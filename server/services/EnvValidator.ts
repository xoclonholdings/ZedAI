/**
 * Pure validation of process.env against ZED's deploy requirements.
 *
 * Single-objective: produce the list of EnvCheck entries the admin
 * UI renders. No HTTP, no side effects — call this from a route, a
 * CLI smoke test, or a CI gate.
 */

export type EnvSeverity = "ok" | "warn" | "error";

export interface EnvCheck {
  name: string;
  severity: EnvSeverity;
  message: string;
  hint?: string;
}

export interface EnvValidationResult {
  ok: boolean;
  summary: { ok: number; warn: number; error: number };
  checks: EnvCheck[];
}

function trimmed(env: NodeJS.ProcessEnv, k: string): string {
  return (env[k] ?? "").trim();
}

function present(env: NodeJS.ProcessEnv, k: string): boolean {
  return trimmed(env, k).length > 0;
}

function checkUrl(
  env: NodeJS.ProcessEnv,
  name: string,
  expectedSuffix?: string,
): EnvCheck | null {
  const raw = trimmed(env, name);
  if (!raw) return null;
  const malformedChars = /[<>"`\s]/;
  if (malformedChars.test(raw)) {
    return {
      name,
      severity: "error",
      message: `Contains illegal characters (one of: < > " \` whitespace). Likely a copy-paste mistake.`,
      hint: "Remove any angle brackets / quotes; the value should be the raw URL only.",
    };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      name,
      severity: "error",
      message: `"${raw.slice(0, 80)}" is not a valid URL.`,
    };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return {
      name,
      severity: "error",
      message: `Expected http(s) but got ${url.protocol}.`,
    };
  }
  if (raw.endsWith("/")) {
    return {
      name,
      severity: "warn",
      message: "URL has a trailing slash; some gateways double-up paths.",
      hint: "Remove the trailing slash.",
    };
  }
  if (expectedSuffix && !raw.toLowerCase().endsWith(expectedSuffix.toLowerCase())) {
    return {
      name,
      severity: "warn",
      message: `Doesn't end in "${expectedSuffix}". Most OpenAI-compatible providers expect a base URL ending there.`,
      hint: `Try ${raw.replace(/\/+$/, "")}${expectedSuffix} unless your provider documents a different path.`,
    };
  }
  return {
    name,
    severity: "ok",
    message: `${url.host}${url.pathname || ""} — looks well-formed.`,
  };
}

function pushLightningChecks(env: NodeJS.ProcessEnv, checks: EnvCheck[]): void {
  const baseUrl = trimmed(env, "LIGHTNING_BASE_URL") || trimmed(env, "REMOTE_INFERENCE_URL");
  if (!baseUrl) {
    checks.push({
      name: "LIGHTNING_BASE_URL",
      severity: "error",
      message: "Not set. Lightning AI endpoint URL is required.",
      hint: "Point it at your Lightning AI runner (e.g. https://<your-endpoint>.lightning.ai).",
    });
  } else {
    const check = checkUrl(env, "LIGHTNING_BASE_URL") || checkUrl(env, "REMOTE_INFERENCE_URL");
    if (check) checks.push({ ...check, name: "LIGHTNING_BASE_URL" });
  }

  if (!present(env, "LIGHTNING_MODEL") && !present(env, "MODEL_NAME")) {
    checks.push({
      name: "LIGHTNING_MODEL",
      severity: "warn",
      message:
        "Not set. Per-lane MODEL_<LANE> overrides must be set or the runner needs its own default.",
      hint: "Set LIGHTNING_MODEL to the model identifier your Lightning runner serves by default.",
    });
  } else {
    checks.push({
      name: "LIGHTNING_MODEL",
      severity: "ok",
      message: `Default model: ${trimmed(env, "LIGHTNING_MODEL") || trimmed(env, "MODEL_NAME")}.`,
    });
  }
}

function pushSessionSecretCheck(env: NodeJS.ProcessEnv, checks: EnvCheck[]): void {
  const sessionSecret = trimmed(env, "SESSION_SECRET");
  if (!sessionSecret) {
    checks.push({
      name: "SESSION_SECRET",
      severity: "error",
      message: "Not set. Session cookies cannot be signed; logins will fail.",
      hint: "Generate a 32-byte random hex string.",
    });
  } else if (sessionSecret.length < 24) {
    checks.push({
      name: "SESSION_SECRET",
      severity: "error",
      message: `Only ${sessionSecret.length} characters — too short to be cryptographically strong.`,
      hint: "Use at least 32 random characters (e.g. openssl rand -hex 32).",
    });
  } else if (/@/.test(sessionSecret) || /^[a-zA-Z]+$/.test(sessionSecret)) {
    checks.push({
      name: "SESSION_SECRET",
      severity: "error",
      message: "Looks like an email or simple word, not a random secret.",
      hint: "Replace with a high-entropy random string (32+ bytes).",
    });
  } else if (/^(password|secret|admin|test|changeme)/i.test(sessionSecret)) {
    checks.push({
      name: "SESSION_SECRET",
      severity: "warn",
      message: "Starts with a common dictionary word.",
    });
  } else {
    checks.push({
      name: "SESSION_SECRET",
      severity: "ok",
      message: `Set (length ${sessionSecret.length}).`,
    });
  }
}

function pushDatabaseCheck(env: NodeJS.ProcessEnv, checks: EnvCheck[]): void {
  const dbUrl = trimmed(env, "DATABASE_URL");
  if (!dbUrl) {
    checks.push({
      name: "DATABASE_URL",
      severity: "error",
      message: "Not set. Database access will fail.",
    });
    return;
  }
  if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
    checks.push({
      name: "DATABASE_URL",
      severity: "error",
      message: 'Does not start with "postgres://" or "postgresql://".',
      hint: "Drizzle expects a Postgres connection string.",
    });
    return;
  }
  try {
    const u = new URL(dbUrl);
    checks.push({
      name: "DATABASE_URL",
      severity: "ok",
      message: `${u.hostname}${u.pathname} — well-formed Postgres URL.`,
    });
  } catch {
    checks.push({
      name: "DATABASE_URL",
      severity: "error",
      message: "Could not parse as a URL.",
    });
  }
}

function pushAdminAuthChecks(env: NodeJS.ProcessEnv, checks: EnvCheck[]): void {
  if (!present(env, "ZED_ADMIN_USERNAME")) {
    checks.push({
      name: "ZED_ADMIN_USERNAME",
      severity: "error",
      message: "Not set. Admin login form will reject every attempt.",
    });
  } else {
    checks.push({
      name: "ZED_ADMIN_USERNAME",
      severity: "ok",
      message: `Set to "${trimmed(env, "ZED_ADMIN_USERNAME")}".`,
    });
  }

  if (!present(env, "ZED_ADMIN_PASSWORD") && !present(env, "ZED_ADMIN_SECURE_PHRASE")) {
    checks.push({
      name: "ZED_ADMIN_PASSWORD",
      severity: "error",
      message:
        "Neither ZED_ADMIN_PASSWORD nor ZED_ADMIN_SECURE_PHRASE is set. Admin login is impossible.",
    });
  } else if (
    present(env, "ZED_ADMIN_PASSWORD") &&
    trimmed(env, "ZED_ADMIN_PASSWORD").length < 10
  ) {
    checks.push({
      name: "ZED_ADMIN_PASSWORD",
      severity: "warn",
      message: `Only ${trimmed(env, "ZED_ADMIN_PASSWORD").length} characters — short.`,
      hint: "Use 16+ characters for a public deploy.",
    });
  } else {
    checks.push({
      name: "ZED_ADMIN_PASSWORD",
      severity: "ok",
      message: "Set with reasonable length.",
    });
  }
}

export function validateEnv(
  env: NodeJS.ProcessEnv = process.env,
): EnvValidationResult {
  const checks: EnvCheck[] = [];

  // Lightning AI is the only provider. No selection to validate — just
  // check that its endpoint and default model are configured.
  checks.push({
    name: "Provider",
    severity: "ok",
    message: "Lightning AI (the only provider).",
  });

  pushLightningChecks(env, checks);

  // 2. Per-lane overrides (informational only)
  const lanes = ["CHAT", "MANAGER", "OPERATIONS", "RESEARCH", "BUSINESS", "FINANCE"];
  const overrideCount = lanes.filter((lane) => present(env, `MODEL_${lane}`)).length;
  if (overrideCount > 0) {
    checks.push({
      name: "MODEL_<lane> overrides",
      severity: "ok",
      message: `${overrideCount} of ${lanes.length} lanes have explicit overrides.`,
    });
  }

  pushSessionSecretCheck(env, checks);
  pushDatabaseCheck(env, checks);
  pushAdminAuthChecks(env, checks);

  const frontendUrlCheck = checkUrl(env, "FRONTEND_URL");
  if (frontendUrlCheck) checks.push(frontendUrlCheck);

  if (present(env, "BRAVE_SEARCH_API_KEY")) {
    checks.push({
      name: "BRAVE_SEARCH_API_KEY",
      severity: "ok",
      message: "Set — web search via Brave is wired.",
    });
  }

  const summary = {
    ok: checks.filter((c) => c.severity === "ok").length,
    warn: checks.filter((c) => c.severity === "warn").length,
    error: checks.filter((c) => c.severity === "error").length,
  };

  return { ok: summary.error === 0, summary, checks };
}
