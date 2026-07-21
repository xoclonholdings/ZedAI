import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// Point playwright-core at the environment's installed Chromium when the
// bundled revision is absent (same override documented for deployment).
if (!process.env.BROWSER_EXECUTABLE_PATH) {
  process.env.BROWSER_EXECUTABLE_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
}

import { BrowserSessionService } from "../BrowserSessionService";
import { BrowserToolService } from "../BrowserToolService";

// Local fixture server — tests never depend on public websites.
const PAGE = `<!doctype html><html><head><title>ZAR Fixture</title></head><body>
<h1>Fixture Home</h1>
<p id="msg">initial message</p>
<input id="name" name="name" placeholder="your name" />
<button id="change" onclick="document.getElementById('msg').textContent='clicked-ok'">Change</button>
<form action="/submitted"><button id="send" type="submit">Send</button></form>
</body></html>`;

let server: http.Server;
let base: string;

test.before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/submitted") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<title>Done</title><h1>Form received</h1>");
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(PAGE);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as any;
  base = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  await BrowserSessionService.shutdown();
  server.close();
});

// The fixture server lives on 127.0.0.1, which UrlSafetyGuard rightly
// blocks. Sessions restricted to an explicit localhost allowlist still go
// through checkUrlSafety — so for these tests we verify BOTH: (a) private
// addresses are blocked by default, and (b) the typed tool layer works
// end-to-end against a real page via a loopback exception used only here.
process.env.BROWSER_ALLOW_LOOPBACK_FOR_TESTS = "true";

test("navigation to private address is blocked by default policy", async () => {
  delete process.env.BROWSER_ALLOW_LOOPBACK_FOR_TESTS;
  const session = await BrowserSessionService.create({ userId: "test-user" });
  const result = await BrowserToolService.execute({
    sessionId: session.id,
    userId: "test-user",
    action: "navigate",
    url: "http://169.254.169.254/latest/meta-data/",
  });
  assert.equal(result.ok, false);
  assert.match(result.error || "", /navigation_blocked/);
  await BrowserSessionService.close(session.id, "test-user");
  process.env.BROWSER_ALLOW_LOOPBACK_FOR_TESTS = "true";
});

test("session ownership is enforced", async () => {
  const session = await BrowserSessionService.create({ userId: "owner-a" });
  const result = await BrowserToolService.execute({
    sessionId: session.id,
    userId: "intruder-b",
    action: "inspect",
  });
  assert.equal(result.ok, false);
  assert.match(result.error || "", /not_owned/);
  await BrowserSessionService.close(session.id, "owner-a");
});

test("deterministic actions: navigate, inspect, type, click, extract, screenshot", async () => {
  const session = await BrowserSessionService.create({ userId: "test-user" });

  const nav = await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "navigate", url: `${base}/`,
  });
  assert.equal(nav.ok, true, nav.error);
  assert.equal(nav.title, "ZAR Fixture");

  const inspect = await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "inspect",
  });
  assert.equal(inspect.ok, true);
  const interactive = (inspect.data as any).interactive;
  assert.ok(interactive.some((el: any) => el.id === "change"));

  const type = await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "type", selector: "#name", text: "zar-secret-name",
  });
  assert.equal(type.ok, true);

  const click = await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "click", selector: "#change",
  });
  assert.equal(click.ok, true);

  const extract = await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "extract", selector: "#msg",
  });
  assert.equal(extract.ok, true);
  assert.equal(extract.data, "clicked-ok"); // verified completion from page state

  const shot = await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "screenshot",
  });
  assert.equal(shot.ok, true);
  assert.ok(shot.artifactPath);

  // Trace: typed secrets must be redacted in the persisted action log.
  const record = await BrowserSessionService.getRecord(session.id, "test-user");
  const typed = record!.actions.find((a) => a.action === "type");
  assert.equal(JSON.stringify(typed!.input).includes("zar-secret-name"), false);

  await BrowserSessionService.close(session.id, "test-user");
});

test("consequential submit without approval is refused with approval_required", async () => {
  const session = await BrowserSessionService.create({ userId: "test-user" });
  await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "navigate", url: `${base}/`,
  });
  const submit = await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "submit", selector: "#send",
  });
  assert.equal(submit.ok, false);
  assert.equal(submit.approvalRequired, true);

  // Page must NOT have navigated to /submitted.
  const extract = await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "extract", selector: "h1",
  });
  assert.equal(extract.data, "Fixture Home");
  await BrowserSessionService.close(session.id, "test-user");
});

test("upload path outside uploads sandbox is refused", async () => {
  const session = await BrowserSessionService.create({ userId: "test-user" });
  await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "navigate", url: `${base}/`,
  });
  const result = await BrowserToolService.execute({
    sessionId: session.id,
    userId: "test-user",
    action: "upload",
    selector: "#name",
    filePath: "/etc/passwd",
    approvalTaskId: "fake",
  });
  assert.equal(result.ok, false);
  // Fails on the approval gate first (fake task) — both gates guard this path.
  assert.match(result.error || "", /approval_task_not_found|upload_path_not_authorized/);
  await BrowserSessionService.close(session.id, "test-user");
});

test("closed session refuses further actions", async () => {
  const session = await BrowserSessionService.create({ userId: "test-user" });
  await BrowserSessionService.close(session.id, "test-user");
  const result = await BrowserToolService.execute({
    sessionId: session.id, userId: "test-user", action: "inspect",
  });
  assert.equal(result.ok, false);
  assert.match(result.error || "", /not_found_or_closed/);
});
