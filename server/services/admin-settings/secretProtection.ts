import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

import type { AdminSettings } from "../../../shared/adminSettings";

const ENVELOPE_PREFIX = "zar-secret:v1:";
const ENCRYPTION_CONTEXT = "zar-admin-integrations:v1";

type SettingsShape = Partial<AdminSettings> & Record<string, any>;
type SecretTransformer = (value: string) => string;

function keyMaterial(secret: string): Buffer {
  return createHash("sha256")
    .update(`${ENCRYPTION_CONTEXT}:${secret}`, "utf8")
    .digest();
}

function candidateSecrets(): string[] {
  const configured = [
    process.env.ZAR_INTEGRATION_ENCRYPTION_KEY?.trim(),
    process.env.SESSION_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value));

  if (configured.length > 0) return [...new Set(configured)];
  throw new Error(
    "SESSION_SECRET or ZAR_INTEGRATION_ENCRYPTION_KEY is required to protect stored secrets",
  );
}

export function isProtectedSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENVELOPE_PREFIX);
}

export function protectSecret(value: string): string {
  if (!value || isProtectedSecret(value)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(candidateSecrets()[0]), iv);
  cipher.setAAD(Buffer.from(ENCRYPTION_CONTEXT, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENVELOPE_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function revealSecret(value: string): string {
  if (!value || !isProtectedSecret(value)) return value;

  const encoded = value.slice(ENVELOPE_PREFIX.length);
  const [ivValue, tagValue, ciphertextValue, ...unexpected] = encoded.split(".");
  if (!ivValue || !tagValue || !ciphertextValue || unexpected.length > 0) {
    throw new Error("Stored secret has an invalid encryption envelope");
  }

  const iv = Buffer.from(ivValue, "base64url");
  const tag = Buffer.from(tagValue, "base64url");
  const ciphertext = Buffer.from(ciphertextValue, "base64url");

  for (const secret of candidateSecrets()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", keyMaterial(secret), iv);
      decipher.setAAD(Buffer.from(ENCRYPTION_CONTEXT, "utf8"));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      // Try the SESSION_SECRET fallback when a dedicated key was added later.
    }
  }

  throw new Error("Stored secret could not be decrypted with the configured key");
}

function cloneSettings<T>(settings: T): T {
  return JSON.parse(JSON.stringify(settings)) as T;
}

function transformField(target: any, key: string, transform: SecretTransformer) {
  if (!target || typeof target[key] !== "string" || target[key].length === 0) return;
  target[key] = transform(target[key]);
}

function transformAccounts(group: any, keys: string[], transform: SecretTransformer) {
  if (!Array.isArray(group?.accounts)) return;
  for (const account of group.accounts) {
    for (const key of keys) transformField(account, key, transform);
  }
}

function transformIntegrationSecrets<T extends SettingsShape>(
  settings: T,
  transform: SecretTransformer,
): T {
  const next = cloneSettings(settings);
  transformField(next.auth, "securePhrase", transform);
  transformField(next.auth, "sessionSecret", transform);

  const integrations = next.integrations;
  if (!integrations) return next;

  transformField(integrations.github, "token", transform);
  transformAccounts(integrations.github, ["token"], transform);

  transformField(integrations.email, "password", transform);
  transformAccounts(integrations.email, ["password"], transform);
  transformAccounts(integrations.google, ["clientSecret", "refreshToken"], transform);

  transformField(integrations.telephony, "apiKey", transform);
  transformField(integrations.firewall, "authToken", transform);

  transformField(integrations.deployment, "accessToken", transform);
  transformAccounts(integrations.deployment, ["accessToken"], transform);

  transformField(integrations.payments, "secretKey", transform);
  transformField(integrations.payments, "webhookSecret", transform);
  transformAccounts(integrations.payments, ["secretKey", "webhookSecret"], transform);

  transformField(integrations.socialPublishing, "accessToken", transform);
  transformAccounts(integrations.socialPublishing, ["accessToken", "sessionState"], transform);
  if (Array.isArray(integrations.socialPublishing?.accounts)) {
    for (const account of integrations.socialPublishing.accounts) delete (account as any).password;
  }

  transformField(integrations.crm, "apiKey", transform);
  transformAccounts(integrations.crm, ["apiKey"], transform);

  transformField(integrations.accounting, "clientSecret", transform);
  transformField(integrations.accounting, "refreshToken", transform);
  transformAccounts(integrations.accounting, ["clientSecret", "refreshToken"], transform);

  transformField(integrations.cloudStorage, "accessToken", transform);
  transformAccounts(integrations.cloudStorage, ["accessToken"], transform);

  transformField(integrations.tradingView, "alertWebhookSecret", transform);

  transformField(integrations.marketData, "apiKey", transform);
  transformAccounts(integrations.marketData, ["apiKey"], transform);

  if (Array.isArray(integrations.custom)) {
    for (const integration of integrations.custom) {
      if (!Array.isArray(integration?.fields)) continue;
      for (const field of integration.fields) {
        if (field?.isSecret) transformField(field, "value", transform);
      }
    }
  }

  return next;
}

export function protectAdminSettingsForStorage<T extends SettingsShape>(settings: T): T {
  return transformIntegrationSecrets(settings, protectSecret);
}

export function revealStoredAdminSettings<T extends SettingsShape>(settings: T): T {
  return transformIntegrationSecrets(settings, revealSecret);
}

export function storedAdminSettingsNeedProtection(settings: SettingsShape): boolean {
  const protectedSettings = protectAdminSettingsForStorage(settings);
  const original = JSON.stringify(settings);
  const protectedJson = JSON.stringify(protectedSettings);
  return original !== protectedJson;
}
