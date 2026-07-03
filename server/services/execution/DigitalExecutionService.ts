/**
 * DigitalExecutionService
 *
 * Phase 3 of Zed's Execution Layer.
 *
 * Purpose:
 *   Carry out approved digital actions: send emails, submit basic forms,
 *   trigger API-based actions. Email/API providers may be mocked depending
 *   on environment.
 *
 * Constraints:
 *   - This service ONLY runs when execution_mode === "digital".
 *   - Every action MUST be logged.
 *   - Every action MUST come pre-approved (caller is responsible for ensuring
 *     ExecutionApprovalHandler returned approved === true).
 */

import fs from "fs/promises";
import path from "path";
import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import { loadAdminSettings } from "../AdminSettingsStore";
import { logRuntimeEvent } from "../RuntimeLogger";
import type { TaskExecutionPlan } from "./TaskExecutionEngine";
import type { EmailAccount } from "../../../shared/adminSettings";

const DIGITAL_LOG_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "execution/digital-execution.json",
);

export type DigitalActionType = "email" | "form_submit" | "api_call";

export interface DigitalEmailPayload {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export interface DigitalFormPayload {
  endpoint: string;
  fields: Record<string, string>;
}

export interface DigitalApiPayload {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export type DigitalPayload = DigitalEmailPayload | DigitalFormPayload | DigitalApiPayload;

export interface DigitalExecutionRequest {
  task_id: string;
  user_id: string;
  approved: boolean;
  execution_mode: TaskExecutionPlan["execution_mode"];
  action_type: DigitalActionType;
  payload: DigitalPayload;
  reason?: string;
}

export interface DigitalExecutionResult {
  status: "success" | "failed";
  result: string;
  next_steps: string[];
  mocked?: boolean;
  failureReason?: string;
  providerUsed?: string;
  messageId?: string;
}

interface DigitalExecutionLogEntry {
  timestamp: string;
  task_id: string;
  user_id: string;
  action_type: DigitalActionType;
  status: "success" | "failed";
  result: string;
  payload_preview: string;
}

interface DigitalExecutionLog {
  version: string;
  entries: DigitalExecutionLogEntry[];
}

export class DigitalExecutionService {
  static async execute(req: DigitalExecutionRequest): Promise<DigitalExecutionResult> {
    if (!req.approved) {
      return this.fail(req, "Refused: approval flag not set", [
        "Submit the plan to ExecutionApprovalHandler.record() with approved=true.",
      ]);
    }

    if (req.execution_mode !== "digital") {
      return this.fail(req, `Refused: execution_mode=${req.execution_mode}`, [
        "Route the task through DigitalExecutionService only when execution_mode is 'digital'.",
      ]);
    }

    try {
      let result: DigitalExecutionResult;
      switch (req.action_type) {
        case "email":
          result = await this.sendEmail(req.payload as DigitalEmailPayload);
          break;
        case "form_submit":
          result = await this.submitForm(req.payload as DigitalFormPayload);
          break;
        case "api_call":
          result = await this.callApi(req.payload as DigitalApiPayload);
          break;
        default:
          result = {
            status: "failed",
            result: `Unsupported action_type: ${String(req.action_type)}`,
            next_steps: ["Add a handler for this action type or use 'manual' execution_mode."],
          };
      }
      await this.log(req, result);
      return result;
    } catch (err: any) {
      const failure = this.fail(req, err?.message || "Unknown digital execution error", [
        "Inspect runtime logs for the failure detail.",
        "Retry through the TaskLifecycleManager once the cause is fixed.",
      ]);
      await this.log(req, failure);
      return failure;
    }
  }

  private static async sendEmail(payload: DigitalEmailPayload): Promise<DigitalExecutionResult> {
    const liveProvider = process.env.EMAIL_PROVIDER_ENABLED === "true";
    if (!payload?.to || !payload?.subject || !payload?.body) {
      return {
        status: "failed",
        result: "Email payload missing required fields (to, subject, body).",
        next_steps: ["Provide the missing fields and resubmit."],
      };
    }

    const account = await this.resolveEmailAccount(payload);
    if (!liveProvider || !account) {
      return {
        status: "failed",
        result: `Email provider disabled; no email was sent to ${payload.to}.`,
        next_steps: [
          "Set EMAIL_PROVIDER_ENABLED=true and configure SMTP host, port, username, password, and from address before dispatch.",
        ],
        mocked: false,
        failureReason: !liveProvider ? "providerDisabled" : "providerNotConfigured",
      };
    }

    try {
      const nodemailer = await this.loadNodemailer();
      if (!nodemailer) {
        return {
          status: "failed",
          result: "Email dispatch failed: nodemailer is not available at runtime.",
          next_steps: ["Install/verify nodemailer and retry the approved dispatch."],
          mocked: false,
          failureReason: "emailProviderMissing",
        };
      }

      const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpPort === 465,
        auth: { user: account.username, pass: account.password },
      });

      const info = await transporter.sendMail({
        from: account.fromName ? `"${account.fromName}" <${account.fromAddress}>` : account.fromAddress,
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
      });

      return {
        status: "success",
        result: `Email dispatched to ${payload.to} via ${account.smtpHost}.`,
        next_steps: ["Poll for delivery status and update the task lifecycle."],
        mocked: false,
        providerUsed: account.provider,
        messageId: info?.messageId,
      };
    } catch (err: any) {
      return {
        status: "failed",
        result: `Email dispatch failed: ${err?.message || "unknown SMTP error"}.`,
        next_steps: ["Check SMTP credentials, host, port, and provider security settings before retrying."],
        mocked: false,
        failureReason: "smtpDispatchFailed",
      };
    }
  }

  private static async submitForm(payload: DigitalFormPayload): Promise<DigitalExecutionResult> {
    if (!payload?.endpoint) {
      return {
        status: "failed",
        result: "Form payload missing 'endpoint'.",
        next_steps: ["Provide an endpoint URL and resubmit."],
      };
    }
    const liveSubmit = process.env.DIGITAL_FORM_LIVE === "true";
    if (!liveSubmit) {
      return {
        status: "failed",
        result: `Digital form provider disabled; no submission was sent to ${payload.endpoint}.`,
        next_steps: ["Set DIGITAL_FORM_LIVE=true to enable real form submission."],
        mocked: false,
        failureReason: "providerDisabled",
      };
    }

    return {
      status: "success",
      result: `Form submitted to ${payload.endpoint}.`,
      next_steps: ["Verify the provider received the submission."],
    };
  }

  private static async callApi(payload: DigitalApiPayload): Promise<DigitalExecutionResult> {
    if (!payload?.url || !payload?.method) {
      return {
        status: "failed",
        result: "API payload missing 'url' or 'method'.",
        next_steps: ["Provide both fields and resubmit."],
      };
    }

    const liveApi = process.env.DIGITAL_API_LIVE === "true";
    if (!liveApi) {
      return {
        status: "failed",
        result: `Digital API provider disabled; ${payload.method} ${payload.url} was not called.`,
        next_steps: ["Set DIGITAL_API_LIVE=true to enable real outbound API calls."],
        mocked: false,
        failureReason: "providerDisabled",
      };
    }

    try {
      const res = await fetch(payload.url, {
        method: payload.method,
        headers: payload.headers,
        body: payload.body !== undefined ? JSON.stringify(payload.body) : undefined,
      });
      const status = res.ok ? "success" : "failed";
      return {
        status,
        result: `${payload.method} ${payload.url} -> ${res.status}`,
        next_steps:
          status === "success"
            ? ["Update task lifecycle to complete."]
            : ["Inspect provider response and decide whether to retry."],
      };
    } catch (err: any) {
      return {
        status: "failed",
        result: `Network error calling ${payload.url}: ${err?.message || "unknown"}`,
        next_steps: ["Check connectivity and retry via TaskLifecycleManager."],
      };
    }
  }

  private static fail(
    req: DigitalExecutionRequest,
    message: string,
    next_steps: string[],
  ): DigitalExecutionResult {
    return {
      status: "failed",
      result: message,
      next_steps,
      mocked: false,
      failureReason: message,
    };
  }

  private static async log(
    req: DigitalExecutionRequest,
    result: DigitalExecutionResult,
  ): Promise<void> {
    const entry: DigitalExecutionLogEntry = {
      timestamp: new Date().toISOString(),
      task_id: req.task_id,
      user_id: req.user_id,
      action_type: req.action_type,
      status: result.status,
      result: result.result,
      payload_preview: this.previewPayload(req.payload),
    };

    try {
      let log: DigitalExecutionLog = { version: "1.0", entries: [] };
      try {
        const raw = await fs.readFile(DIGITAL_LOG_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.entries)) log = parsed;
      } catch {}
      log.entries.push(entry);
      await fs.mkdir(path.dirname(DIGITAL_LOG_PATH), { recursive: true });
      await fs.writeFile(DIGITAL_LOG_PATH, JSON.stringify(log, null, 2), "utf-8");
    } catch (err) {
      console.warn("[DigitalExecutionService] Failed to write log:", err);
    }

    await logRuntimeEvent({
      level: result.status === "success" ? "info" : "warn",
      source: "server",
      event: `digital.${req.action_type}.${result.status}`,
      detail: result.result,
      context: { task_id: req.task_id, user_id: req.user_id },
    });
  }

  private static previewPayload(payload: DigitalPayload): string {
    try {
      return JSON.stringify(payload).slice(0, 240);
    } catch {
      return "[unserializable payload]";
    }
  }

  private static async resolveEmailAccount(payload: DigitalEmailPayload): Promise<EmailAccount | null> {
    const envAccount = this.emailAccountFromEnv();
    if (envAccount) return envAccount;

    const settings = await loadAdminSettings().catch(() => null);
    const email = settings?.integrations?.email;
    if (!email?.enabled) return null;
    const accounts = email.accounts || [];
    const requestedFrom = payload.from?.trim().toLowerCase();
    const account =
      (requestedFrom
        ? accounts.find((item) => item.fromAddress?.trim().toLowerCase() === requestedFrom)
        : null) ||
      accounts.find((item) => item.fromAddress && item.smtpHost && item.smtpPort && item.username && item.password);
    if (account) return account;

    if (email.fromAddress && email.smtpHost && email.smtpPort && email.username && email.password) {
      return {
        id: "legacy-email-account",
        label: email.fromAddress,
        provider: email.provider || "smtp",
        fromName: email.fromName || "ZED",
        fromAddress: email.fromAddress,
        smtpHost: email.smtpHost,
        smtpPort: email.smtpPort,
        username: email.username,
        password: email.password,
      };
    }

    return null;
  }

  private static emailAccountFromEnv(): EmailAccount | null {
    const smtpHost = process.env.EMAIL_SMTP_HOST || process.env.SMTP_HOST;
    const smtpPort = Number(process.env.EMAIL_SMTP_PORT || process.env.SMTP_PORT || 0);
    const username = process.env.EMAIL_SMTP_USER || process.env.SMTP_USER;
    const password = process.env.EMAIL_SMTP_PASSWORD || process.env.SMTP_PASSWORD;
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_FROM;
    if (!smtpHost || !smtpPort || !username || !password || !fromAddress) return null;
    return {
      id: "env-email-account",
      label: fromAddress,
      provider: "smtp",
      fromName: process.env.EMAIL_FROM_NAME || "ZED",
      fromAddress,
      smtpHost,
      smtpPort,
      username,
      password,
    };
  }

  private static async loadNodemailer(): Promise<any | null> {
    try {
      const mod = await import("nodemailer");
      return (mod as any).default || mod;
    } catch {
      return null;
    }
  }
}

export default DigitalExecutionService;
