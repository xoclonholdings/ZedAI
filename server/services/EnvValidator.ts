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

function firstPresent(
  env: NodeJS.ProcessEnv,
  keys: string[],
): { key: string; value: string } | null {
  for (const key of keys) {
    const value = trimmed(env, key);
    if (value) return { key, value };
  }
  return null;
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
      message: `Doesn't end in "${expectedSuffix}". Gateways that speak the chat-completions schema usually expect a base URL ending there.`,
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
  const defaultBaseUrl = "https://lightning.ai/api/v1";
  const baseUrlKey = present(env, "LIGHTNING_BASE_URL")
    ? "LIGHTNING_BASE_URL"
    : present(env, "LIGHTNING_AI_URL")
      ? "LIGHTNING_AI_URL"
      : null;

  if (!baseUrlKey) {
    checks.push({
      name: "LIGHTNING_BASE_URL",
      severity: "ok",
      message: `Using default Lightning Model APIs base URL: ${defaultBaseUrl}.`,
      hint: "Set LIGHTNING_BASE_URL only if Lightning changes the endpoint or you run a dedicated deployment.",
    });
  } else {
    const check = checkUrl(env, baseUrlKey);
    if (check) checks.push({ ...check, name: "LIGHTNING_BASE_URL" });
  }

  const apiKeyKey = firstPresent(env, [
    "LIGHTNING_API_KEY",
    "LIGHTNING_AI_API_KEY",
    "LIGHTNING_TOKEN",
  ]);
  if (!apiKeyKey) {
    checks.push({
      name: "LIGHTNING_API_KEY",
      severity: "error",
      message:
        "Not set. Lightning endpoints are token-protected; without it every model call fails with 401 'Missing or invalid Authorization header'.",
      hint: "Set LIGHTNING_API_KEY to your Lightning AI endpoint token.",
    });
  } else {
    checks.push({
      name: "LIGHTNING_API_KEY",
      severity: "ok",
      message: "Set — sent as the Authorization: Bearer token on every Lightning request.",
    });
  }

  const lightningModels = firstPresent(env, ["LIGHTNING_MODELS"]);
  const lightningModel = firstPresent(env, ["LIGHTNING_MODEL"]);
  const legacyModel = firstPresent(env, ["MODEL_NAME", "ZED_MODEL_NAME"]);
  if (lightningModels) {
    checks.push({
      name: "AI_MODEL",
      severity: "ok",
      message: `Using approved Lightning models ${lightningModels.value}. Lane and reasoning model routing remains disabled.`,
    });
  } else if (lightningModel) {
    checks.push({
      name: "AI_MODEL",
      severity: "ok",
      message: `Using approved Lightning model ${lightningModel.value}. Lane and reasoning model routing remains disabled.`,
    });
  } else if (!baseUrlKey) {
    checks.push({
      name: "AI_MODEL",
      severity: "ok",
      message:
        "Using approved Lightning Model APIs models lightning-ai/gpt-oss-120b and lightning-ai/gemma-4-31B-it.",
      hint: "Set LIGHTNING_MODELS only if Lightning changes the approved global API models.",
    });
  } else {
    checks.push({
      name: "AI_MODEL",
      severity: "ok",
      message: "No model selector sent. Zed will let the Lightning deployment choose.",
      hint: "No action needed for a compiled Lightning deployment.",
    });
  }

  if (legacyModel) {
    checks.push({
      name: "Legacy AI_MODEL",
      severity: "warn",
      message: `${legacyModel.key} is set to ${legacyModel.value}, but legacy model overrides are ignored.`,
      hint: "Remove MODEL_NAME / ZED_MODEL_NAME so there is no confusion.",
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

  // 2. Legacy model override env vars are ignored by design.
  const lanes = ["CHAT", "MANAGER", "OPERATIONS", "RESEARCH", "BUSINESS", "FINANCE", "STRATEGY", "ADMIN"];
  const overrideCount = lanes.filter((lane) => present(env, `MODEL_${lane}`)).length;
  if (overrideCount > 0) {
    checks.push({
      name: "MODEL_<lane> overrides",
      severity: "warn",
      message: `${overrideCount} legacy lane model override(s) are set but ignored. Zed uses one Lightning deployment.`,
      hint: "Remove MODEL_<LANE> values such as MODEL_FINANCE to avoid confusion.",
    });
  }

  const reasoningEfforts = ["LOW", "MEDIUM", "HIGH", "DEEP"];
  const reasoningOverrideCount = reasoningEfforts.filter((effort) =>
    present(env, `MODEL_REASONING_${effort}`),
  ).length;
  const laneReasoningOverrideCount = lanes.reduce(
    (count, lane) =>
      count + reasoningEfforts.filter((effort) => present(env, `MODEL_${lane}_${effort}`)).length,
    0,
  );
  if (reasoningOverrideCount > 0 || laneReasoningOverrideCount > 0) {
    checks.push({
      name: "MODEL_REASONING_<effort> overrides",
      severity: "warn",
      message: `${reasoningOverrideCount} general and ${laneReasoningOverrideCount} lane-specific reasoning model override(s) are set but ignored.`,
      hint: "Remove MODEL_REASONING_<EFFORT> and MODEL_<LANE>_<EFFORT>; Lightning handles routing inside the deployment.",
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
