export const REQUIRED_PRODUCTION_ENV_VARS = [
  "ZED_ADMIN_USERNAME",
  "ZED_ADMIN_SECURE_PHRASE",
  "ZED_ADMIN_PASSWORD",
  "SESSION_SECRET",
] as const;

export function nowIso() {
  return new Date().toISOString();
}

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export function requireProductionEnv(name: (typeof REQUIRED_PRODUCTION_ENV_VARS)[number]) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set in production`);
  }
  return value;
}

export function getEnvOrDevelopmentDefault(name: string, developmentDefault: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (isProductionEnvironment()) {
    throw new Error(`${name} must be set in production`);
  }

  return developmentDefault;
}

/** Fails fast in production when any of the required env vars are missing. */
export function assertProductionEnvConfiguration() {
  if (!isProductionEnvironment()) {
    return;
  }

  for (const name of REQUIRED_PRODUCTION_ENV_VARS) {
    requireProductionEnv(name);
  }
}
