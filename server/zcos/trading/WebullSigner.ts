import { createHash, createHmac, randomUUID } from "crypto";

/**
 * Native (no-Python) implementation of Webull OpenAPI request signing,
 * per developer.webull.com/apis/docs/authentication/signature.
 *
 * Every request is signed with HMAC-SHA1 over a canonical string built
 * from the path, query params, and the signing headers — there is no
 * separate access-token exchange. This lets ZAR sign Webull calls from
 * pure Node, removing the Python SDK subprocess (and its 3.8-3.13 runtime
 * constraint) entirely.
 *
 * Verified against the doc's worked example (see WebullSigner.test logic).
 */

const SIGN_ALGORITHM = "HMAC-SHA1";
const SIGN_VERSION = "1.0";
const INTERFACE_VERSION = "v2";

export interface WebullSignInput {
  path: string;
  host: string;
  appKey: string;
  appSecret: string;
  query?: Record<string, string | string[]>;
  /** Exact JSON string sent as the body, or empty/undefined for none. */
  bodyString?: string;
  /** Test overrides. */
  timestamp?: string;
  nonce?: string;
}

export type WebullSignedHeaders = Record<string, string>;

/** ISO 8601 with no milliseconds: YYYY-MM-DDThh:mm:ssZ. */
export function webullTimestamp(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Percent-encode exactly like Python's urllib.parse.quote(s, safe="").
 * Unreserved set kept as-is: A-Za-z0-9 and _.-~ ; everything else
 * (including / & = :) is percent-encoded from its UTF-8 bytes.
 */
export function webullQuote(input: string): string {
  const bytes = Buffer.from(input, "utf8");
  let out = "";
  for (const byte of bytes) {
    const ch = String.fromCharCode(byte);
    if (/[A-Za-z0-9_.\-~]/.test(ch)) out += ch;
    else out += "%" + byte.toString(16).toUpperCase().padStart(2, "0");
  }
  return out;
}

/**
 * str1: merge query params + signing headers, sort names ascending, and
 * join as name=value with &. Duplicate values for one name are sorted
 * ascending and joined with & (per the Edge Cases section).
 */
export function buildSignatureParamString(params: Record<string, string | string[]>): string {
  return Object.keys(params)
    .sort()
    .map((name) => {
      const raw = params[name];
      const value = Array.isArray(raw) ? [...raw].sort().join("&") : raw;
      return `${name}=${value}`;
    })
    .join("&");
}

/** Compute the base64 HMAC-SHA1 signature and the full header set. */
export function webullSign(input: WebullSignInput): {
  signature: string;
  headers: WebullSignedHeaders;
  encoded: string;
} {
  const timestamp = input.timestamp || webullTimestamp();
  const nonce = input.nonce || randomUUID().replace(/-/g, "");

  const signingHeaders: Record<string, string> = {
    "x-app-key": input.appKey,
    "x-timestamp": timestamp,
    "x-signature-algorithm": SIGN_ALGORITHM,
    "x-signature-version": SIGN_VERSION,
    "x-signature-nonce": nonce,
    host: input.host,
  };

  const merged: Record<string, string | string[]> = { ...(input.query || {}), ...signingHeaders };
  const str1 = buildSignatureParamString(merged);

  const hasBody = typeof input.bodyString === "string" && input.bodyString.length > 0;
  const str3 = hasBody
    ? `${input.path}&${str1}&${createHash("md5").update(input.bodyString as string, "utf8").digest("hex").toUpperCase()}`
    : `${input.path}&${str1}`;

  const encoded = webullQuote(str3);
  const signature = createHmac("sha1", `${input.appSecret}&`).update(encoded, "utf8").digest("base64");

  return {
    signature,
    encoded,
    headers: {
      "x-app-key": input.appKey,
      "x-timestamp": timestamp,
      "x-signature": signature,
      "x-signature-algorithm": SIGN_ALGORITHM,
      "x-signature-version": SIGN_VERSION,
      "x-signature-nonce": nonce,
      "x-version": INTERFACE_VERSION,
      host: input.host,
    },
  };
}
