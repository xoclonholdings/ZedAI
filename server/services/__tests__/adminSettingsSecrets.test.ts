import test from "node:test";
import assert from "node:assert/strict";

import { mergeSecretAccounts, preserveSecret } from "../AdminSettingsStore";
import { mergeSettings } from "../admin-settings/mergeSettings";

test("preserveSecret clears the value when the caller sends an explicit empty string (Disconnect)", () => {
  const current = { apiKey: "sk-live-123" };
  const next = { apiKey: "" };
  assert.equal(preserveSecret(current, next, "apiKey"), "");
});

test("preserveSecret keeps the current value when the field is omitted from the patch", () => {
  const current = { apiKey: "sk-live-123" };
  const next = {};
  assert.equal(preserveSecret(current, next, "apiKey"), "sk-live-123");
});

test("preserveSecret keeps the current value when the client echoes back the masked placeholder", () => {
  const current = { apiKey: "sk-live-123" };
  const next = { apiKey: "•••••• (set)" };
  assert.equal(preserveSecret(current, next, "apiKey"), "sk-live-123");
});

test("mergeSecretAccounts upserts by id instead of dropping accounts absent from the patch", () => {
  const current = [
    { id: "email-gmail", provider: "gmail", password: "gmail-pass" },
    { id: "email-outlook", provider: "outlook", password: "outlook-pass" },
  ];
  // A save of one provider's dialog only ever carries that one account.
  const next = [{ id: "email-outlook", provider: "outlook", password: "new-outlook-pass" }];

  const merged = mergeSecretAccounts(current, next, ["password"]);

  assert.equal(merged.length, 2, "the untouched gmail account must survive the save");
  const gmail = merged.find((a) => a.id === "email-gmail");
  const outlook = merged.find((a) => a.id === "email-outlook");
  assert.equal(gmail?.password, "gmail-pass");
  assert.equal(outlook?.password, "new-outlook-pass");
});

test("mergeSecretAccounts appends a genuinely new account id", () => {
  const current = [{ id: "email-gmail", provider: "gmail", password: "gmail-pass" }];
  const next = [{ id: "email-icloud", provider: "icloud", password: "icloud-pass" }];

  const merged = mergeSecretAccounts(current, next, ["password"]);

  assert.equal(merged.length, 2);
  assert.ok(merged.some((a) => a.id === "email-gmail"));
  assert.ok(merged.some((a) => a.id === "email-icloud"));
});

test("mergeSettings derives hasApiKey from the current secret only, not a stored flag", () => {
  // Simulates a previously-persisted record where the flag had latched
  // true, but the secret has since been cleared (e.g. via Disconnect).
  const settings = mergeSettings({
    integrations: {
      telephony: { apiKey: "", hasApiKey: true },
    },
  } as any);
  assert.equal(settings.integrations.telephony.hasApiKey, false);
});

test("mergeSettings still reports hasApiKey true while the secret is actually present", () => {
  const settings = mergeSettings({
    integrations: {
      telephony: { apiKey: "real-key" },
    },
  } as any);
  assert.equal(settings.integrations.telephony.hasApiKey, true);
});
