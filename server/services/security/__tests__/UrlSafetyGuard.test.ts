import test from "node:test";
import assert from "node:assert/strict";

import {
  checkUrlSafety,
  isPrivateAddress,
  __setDnsResolverForTest,
} from "../UrlSafetyGuard";

test("blocks non-http(s) schemes", async () => {
  const result = await checkUrlSafety("file:///etc/passwd");
  assert.equal(result.safe, false);
  assert.equal(result.reason, "scheme_not_allowed:file:");
});

test("blocks localhost by name", async () => {
  const result = await checkUrlSafety("http://localhost:8080/admin");
  assert.equal(result.safe, false);
  assert.equal(result.reason, "localhost_blocked");
});

test("blocks literal loopback and private IPv4 addresses", async () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.4.4", "192.168.1.1", "169.254.169.254"]) {
    const result = await checkUrlSafety(`http://${ip}/`);
    assert.equal(result.safe, false, `${ip} should be blocked`);
  }
});

test("blocks the cloud metadata endpoint", async () => {
  const result = await checkUrlSafety("http://169.254.169.254/latest/meta-data/");
  assert.equal(result.safe, false);
  assert.equal(result.reason, "private_ip_literal");
});

test("blocks IPv6 loopback and unique-local/link-local", async () => {
  for (const ip of ["[::1]", "[fc00::1]", "[fe80::1]"]) {
    const result = await checkUrlSafety(`http://${ip}/`);
    assert.equal(result.safe, false, `${ip} should be blocked`);
  }
});

test("blocks URLs carrying userinfo", async () => {
  const result = await checkUrlSafety("http://user:pass@example.com/");
  assert.equal(result.safe, false);
  assert.equal(result.reason, "userinfo_not_allowed");
});

test("allows a public literal IPv4 address", async () => {
  const result = await checkUrlSafety("http://93.184.216.34/");
  assert.equal(result.safe, true);
});

test("blocks a hostname that resolves to a private address (DNS rebinding defense)", async () => {
  __setDnsResolverForTest(async () => [{ address: "127.0.0.1", family: 4 }]);
  try {
    const result = await checkUrlSafety("https://rebind.example.test/");
    assert.equal(result.safe, false);
    assert.equal(result.reason, "resolves_to_private_ip");
  } finally {
    __setDnsResolverForTest(null);
  }
});

test("allows a hostname that resolves only to public addresses", async () => {
  __setDnsResolverForTest(async () => [{ address: "93.184.216.34", family: 4 }]);
  try {
    const result = await checkUrlSafety("https://public.example.test/");
    assert.equal(result.safe, true);
  } finally {
    __setDnsResolverForTest(null);
  }
});

test("isPrivateAddress classifies known ranges correctly", () => {
  assert.equal(isPrivateAddress("8.8.8.8", 4), false);
  assert.equal(isPrivateAddress("100.64.0.1", 4), true);
  assert.equal(isPrivateAddress("198.51.100.1", 4), true);
  assert.equal(isPrivateAddress("::ffff:127.0.0.1", 6), true);
});
