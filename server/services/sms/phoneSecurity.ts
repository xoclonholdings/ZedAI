import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from "crypto";

function keyMaterial(secret: string): Buffer {
  if (secret.trim().length < 32) throw new Error("SMS_ENCRYPTION_KEY must contain at least 32 characters");
  return createHash("sha256").update(secret).digest();
}

export function normalizePhoneNumber(value: string, defaultCountryCode = "1"): string {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("phone number is required");
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  const normalized = hasPlus ? `+${digits}` : digits.length === 10 ? `+${defaultCountryCode}${digits}` : `+${digits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("phone number must be a valid E.164 number");
  return normalized;
}

export function hashPhone(phone: string, secret: string): string {
  return createHmac("sha256", keyMaterial(secret)).update(phone).digest("hex");
}

export function hashVerificationCode(challengeId: string, code: string, secret: string): string {
  return createHmac("sha256", keyMaterial(secret)).update(`${challengeId}:${code}`).digest("hex");
}

export function encryptPhone(phone: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptPhone(value: string, secret: string): string {
  const [ivValue, tagValue, ciphertextValue] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error("invalid encrypted phone value");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(secret), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function lastFour(phone: string): string {
  return phone.slice(-4);
}

export function redactPhone(phone: string): string {
  return `••••${lastFour(phone)}`;
}

export function hashNetworkValue(value: string | undefined, secret: string): string | null {
  if (!value) return null;
  return createHmac("sha256", keyMaterial(secret)).update(value).digest("hex");
}
