/**
 * BrowserToolService — the ONLY surface through which browser actions
 * execute. Typed, validated action contracts; no raw Playwright is ever
 * exposed to the model or routes.
 *
 * Risk model:
 *   observation   — read-only (inspect, extract, screenshot, wait, console)
 *   reversible    — page-local interaction (navigate, click, type, select,
 *                   scroll, download to sandbox)
 *   consequential — leaves the page's sandbox (submitting forms, pressing
 *                   Enter in a form field, uploads of user files). These
 *                   REQUIRE an approved task in the existing execution
 *                   pipeline (ExecutionPipeline/TaskLifecycleManager)
 *                   before they run; the approval task id is recorded in
 *                   the session trace.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { BrowserSessionService, type BrowserSessionRecord } from "./BrowserSessionService";
import { TaskLifecycleManager } from "../execution/TaskLifecycleManager";
import { UPLOADS_DIR } from "../../utils/repoPaths";

export type BrowserActionName =
  | "navigate"
  | "inspect"
  | "click"
  | "type"
  | "select"
  | "scroll"
  | "wait_for"
  | "screenshot"
  | "extract"
  | "console_errors"
  | "download"
  | "upload"
  | "submit"
  | "press_key";

export type BrowserRiskLevel = "observation" | "reversible" | "consequential";

export const BROWSER_ACTION_RISK: Record<BrowserActionName, BrowserRiskLevel> = {
  navigate: "reversible",
  inspect: "observation",
  click: "reversible",
  type: "reversible",
  select: "reversible",
  scroll: "observation",
  wait_for: "observation",
  screenshot: "observation",
  extract: "observation",
  console_errors: "observation",
  download: "reversible",
  upload: "consequential",
  submit: "consequential",
  press_key: "reversible",
};

export interface BrowserActionInput {
  sessionId: string;
  userId: string;
  action: BrowserActionName;
  url?: string;
  selector?: string;
  text?: string;
  value?: string;
  key?: string;
  deltaY?: number;
  timeoutMs?: number;
  state?: "visible" | "attached" | "load";
  /** Server-side file path (must live under uploads/) for upload. */
  filePath?: string;
  /** Approved execution-pipeline task id — required for consequential actions. */
  approvalTaskId?: string;
}

export interface BrowserActionResult {
  ok: boolean;
  action: BrowserActionName;
  risk: BrowserRiskLevel;
  detail?: string;
  url?: string;
  title?: string;
  data?: unknown;
  artifactPath?: string;
  approvalRequired?: boolean;
  approvalTaskId?: string;
  error?: string;
}

const SELECTOR_MAX = 500;
const TEXT_MAX = 5_000;

function sanitizeSelector(selector?: string): string {
  const s = String(selector || "").trim();
  if (!s || s.length > SELECTOR_MAX) throw new Error("invalid_selector");
  return s;
}

/** Consequential actions require an APPROVED task in the existing pipeline. */
async function assertApproved(input: BrowserActionInput): Promise<string> {
  if (!input.approvalTaskId) throw new Error("approval_required");
  const task = await TaskLifecycleManager.get(input.approvalTaskId);
  if (!task) throw new Error("approval_task_not_found");
  if (task.user_id !== input.userId) throw new Error("approval_task_not_owned");
  if (task.status !== "approved") throw new Error(`approval_task_status:${task.status}`);
  return input.approvalTaskId;
}

async function pageSnapshot(page: import("playwright-core").Page) {
  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
  };
}

export class BrowserToolService {
  static riskOf(action: BrowserActionName): BrowserRiskLevel {
    return BROWSER_ACTION_RISK[action];
  }

  static async execute(input: BrowserActionInput): Promise<BrowserActionResult> {
    const risk = BROWSER_ACTION_RISK[input.action];
    if (!risk) {
      return { ok: false, action: input.action, risk: "observation", error: "unknown_action" };
    }

    let approvalTaskId: string | undefined;
    try {
      BrowserSessionService.assertStepBudget(input.sessionId);
      if (risk === "consequential") {
        approvalTaskId = await assertApproved(input);
      }

      const live = BrowserSessionService.getLive(input.sessionId, input.userId);
      const result = await this.dispatch(live.record, live.page, input);
      const snap = await pageSnapshot(live.page);

      await BrowserSessionService.recordAction(input.sessionId, {
        action: input.action,
        input: this.redactInput(input),
        ok: true,
        detail: result.detail,
        url: snap.url,
        approvalTaskId,
      });

      return { ...result, ok: true, action: input.action, risk, ...snap, approvalTaskId };
    } catch (err: any) {
      const message = err?.message || String(err);
      await BrowserSessionService.recordAction(input.sessionId, {
        action: input.action,
        input: this.redactInput(input),
        ok: false,
        detail: message,
        approvalTaskId,
      }).catch(() => {});
      return {
        ok: false,
        action: input.action,
        risk,
        error: message,
        approvalRequired: message === "approval_required",
      };
    }
  }

  /** Never persist typed secrets — the trace stores lengths, not values. */
  private static redactInput(input: BrowserActionInput): Record<string, unknown> {
    const { text, value, ...rest } = input;
    return {
      ...rest,
      text: text !== undefined ? `[${text.length} chars]` : undefined,
      value: value !== undefined ? `[${value.length} chars]` : undefined,
    };
  }

  private static async dispatch(
    record: BrowserSessionRecord,
    page: import("playwright-core").Page,
    input: BrowserActionInput,
  ): Promise<{ detail?: string; data?: unknown; artifactPath?: string }> {
    const timeout = Math.min(Math.max(input.timeoutMs || 10_000, 1_000), 30_000);

    switch (input.action) {
      case "navigate": {
        const url = String(input.url || "").trim();
        if (!url) throw new Error("url_required");
        await BrowserSessionService.authorizeNavigation(record, url);
        const response = await page.goto(url, { timeout, waitUntil: "domcontentloaded" });
        return { detail: `HTTP ${response?.status() ?? "?"} ${page.url()}` };
      }

      case "inspect": {
        // Compact accessibility-oriented snapshot: interactive elements
        // with roles/names — what a model needs to decide the next step.
        const data = await page.evaluate(() => {
          const items: Array<Record<string, string>> = [];
          const nodes = document.querySelectorAll(
            "a[href], button, input, select, textarea, [role=button], [role=link], [role=tab], form",
          );
          let i = 0;
          for (const el of Array.from(nodes).slice(0, 120)) {
            const tag = el.tagName.toLowerCase();
            const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
            const entry: Record<string, string> = { index: String(i++), tag };
            if (text) entry.text = text;
            const id = el.getAttribute("id");
            if (id) entry.id = id;
            const name = el.getAttribute("name");
            if (name) entry.name = name;
            const type = el.getAttribute("type");
            if (type) entry.type = type;
            const placeholder = el.getAttribute("placeholder");
            if (placeholder) entry.placeholder = placeholder;
            const href = el.getAttribute("href");
            if (href) entry.href = href.slice(0, 120);
            const label = el.getAttribute("aria-label");
            if (label) entry.ariaLabel = label;
            items.push(entry);
          }
          return {
            headings: Array.from(document.querySelectorAll("h1,h2,h3"))
              .slice(0, 20)
              .map((h) => `${h.tagName}: ${(h.textContent || "").trim().slice(0, 100)}`),
            interactive: items,
          };
        });
        return { data, detail: `inspected ${((data as any).interactive || []).length} interactive elements` };
      }

      case "click": {
        const selector = sanitizeSelector(input.selector);
        await page.click(selector, { timeout, noWaitAfter: true });
        return { detail: `clicked ${selector}` };
      }

      case "type": {
        const selector = sanitizeSelector(input.selector);
        const text = String(input.text ?? "");
        if (text.length > TEXT_MAX) throw new Error("text_too_long");
        await page.fill(selector, text, { timeout });
        return { detail: `filled ${selector}` };
      }

      case "select": {
        const selector = sanitizeSelector(input.selector);
        await page.selectOption(selector, String(input.value ?? ""), { timeout });
        return { detail: `selected in ${selector}` };
      }

      case "scroll": {
        const deltaY = Math.max(-5_000, Math.min(Number(input.deltaY ?? 600), 5_000));
        await page.mouse.wheel(0, deltaY);
        return { detail: `scrolled ${deltaY}px` };
      }

      case "wait_for": {
        if (input.selector) {
          await page.waitForSelector(sanitizeSelector(input.selector), {
            timeout,
            state: input.state === "attached" ? "attached" : "visible",
          });
          return { detail: `selector present: ${input.selector}` };
        }
        await page.waitForLoadState("load", { timeout });
        return { detail: "page load complete" };
      }

      case "screenshot": {
        const dir = BrowserSessionService.screenshotDir();
        await fs.mkdir(dir, { recursive: true });
        const file = path.join(dir, `${record.id}-${Date.now()}.png`);
        await page.screenshot({ path: file, fullPage: false });
        await BrowserSessionService.addArtifact(record.id, { kind: "screenshot", path: file });
        return { detail: "screenshot captured", artifactPath: file };
      }

      case "extract": {
        const selector = input.selector ? sanitizeSelector(input.selector) : "body";
        const data = await page.$eval(
          selector,
          (el) => (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20_000),
        );
        return { data, detail: `extracted ${String(data).length} chars from ${selector}` };
      }

      case "console_errors": {
        // Collect errors going forward for a short window.
        const errors: string[] = [];
        const handler = (msg: any) => {
          if (msg.type() === "error") errors.push(String(msg.text()).slice(0, 300));
        };
        page.on("console", handler);
        await page.waitForTimeout(Math.min(timeout, 3_000));
        page.off("console", handler);
        return { data: errors, detail: `${errors.length} console errors` };
      }

      case "download": {
        const selector = sanitizeSelector(input.selector);
        const dir = BrowserSessionService.downloadDir();
        await fs.mkdir(dir, { recursive: true });
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout }),
          page.click(selector, { noWaitAfter: true }),
        ]);
        const suggested = download.suggestedFilename().replace(/[^a-zA-Z0-9._-]/g, "_");
        const file = path.join(dir, `${record.id}-${randomUUID().slice(0, 8)}-${suggested}`);
        await download.saveAs(file);
        await BrowserSessionService.addArtifact(record.id, { kind: "download", path: file });
        return { detail: `downloaded ${suggested}`, artifactPath: file };
      }

      case "upload": {
        const selector = sanitizeSelector(input.selector);
        const filePath = path.resolve(String(input.filePath || ""));
        // Only files already inside ZAR's uploads sandbox may be attached.
        if (!filePath.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
          throw new Error("upload_path_not_authorized");
        }
        await fs.access(filePath);
        await page.setInputFiles(selector, filePath, { timeout });
        return { detail: `attached ${path.basename(filePath)} to ${selector}` };
      }

      case "submit": {
        const selector = sanitizeSelector(input.selector);
        await page.click(selector, { timeout });
        await page.waitForLoadState("domcontentloaded", { timeout }).catch(() => {});
        return { detail: `submitted via ${selector}` };
      }

      case "press_key": {
        const key = String(input.key || "").trim();
        if (!/^[A-Za-z0-9+]{1,30}$/.test(key)) throw new Error("invalid_key");
        // Enter inside a form is a submission path — treat as consequential.
        if (key === "Enter" && input.selector) {
          throw new Error("use_submit_action_for_enter");
        }
        await page.keyboard.press(key);
        return { detail: `pressed ${key}` };
      }

      default:
        throw new Error("unknown_action");
    }
  }
}

export default BrowserToolService;
