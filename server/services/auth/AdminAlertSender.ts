/**
 * AdminAlertSender
 *
 * Emails the admin (admin@zed-ai.online) about approval requests, task
 * completions, task failures/blocked, and error-level runtime events.
 *
 * Sender identity is whatever EmailIntegrationSettings.fromAddress is
 * set to (canonically zed@zed-ai.online). When SMTP isn't configured
 * the alert is written to stdout + the runtime log so nothing is lost.
 *
 * Rate-limiting:
 *   - Log alerts: 1 email per 5 min per event-type key.
 *   - Approval / completion / blocked: not rate-limited (they correspond
 *     to discrete user-visible state changes).
 */

import { loadAdminSettings } from "../AdminSettingsStore";
import { logRuntimeEvent } from "../RuntimeLogger";
import { ADMIN_EMAIL } from "./AdminMagicLinkService";
import type { TaskRecord } from "../execution/TaskLifecycleManager";

type DeliveryChannel = "smtp" | "log_fallback";

interface SendResult {
  delivered: boolean;
  channel: DeliveryChannel;
  detail: string;
}

const LOG_RATE_LIMIT_MS = 5 * 60 * 1000;
const lastLogAlertAt = new Map<string, number>();

export interface ApprovalAlertInput {
  task: TaskRecord;
  role: "user" | "admin";
  reason: string;
}

export interface CompletionAlertInput {
  task: TaskRecord;
  result?: Record<string, unknown> | null;
}

export interface BlockedAlertInput {
  task: TaskRecord;
  reason: string;
}

export interface LogAlertInput {
  event: string;
  detail?: string;
  context?: Record<string, unknown>;
}

export class AdminAlertSender {
  static async sendApprovalNeeded(input: ApprovalAlertInput): Promise<SendResult> {
    const subject = `[ZAR] Approval needed — ${input.role} — ${truncate(input.task.plan?.summary || input.task.id, 80)}`;
    const body = [
      `A task is waiting for ${input.role} approval.`,
      ``,
      `Task: ${input.task.id}`,
      `Type: ${input.task.plan?.task_type || "—"}`,
      `Summary: ${input.task.plan?.summary || "—"}`,
      `Required role: ${input.role}`,
      `Reason: ${input.reason}`,
      ``,
      `Steps planned:`,
      ...(input.task.plan?.steps || []).map((s) => `  • ${s}`),
      ``,
      `Open the admin panel to approve or reject.`,
    ].join("\n");
    return this.dispatch({ subject, body, kind: "approval_needed" });
  }

  static async sendTaskCompleted(input: CompletionAlertInput): Promise<SendResult> {
    const subject = `[ZAR] Task complete — ${truncate(input.task.plan?.summary || input.task.id, 80)}`;
    const body = [
      `A task finished successfully.`,
      ``,
      `Task: ${input.task.id}`,
      `Summary: ${input.task.plan?.summary || "—"}`,
      `Mode: ${input.task.plan?.execution_mode || "—"}`,
      ``,
      `Result:`,
      ...(input.result ? [JSON.stringify(input.result, null, 2)] : ["  (no structured result)"]),
    ].join("\n");
    return this.dispatch({ subject, body, kind: "task_completed" });
  }

  static async sendTaskBlocked(input: BlockedAlertInput): Promise<SendResult> {
    const subject = `[ZAR] Task blocked — ${truncate(input.task.plan?.summary || input.task.id, 80)}`;
    const body = [
      `A task is blocked and won't progress without action.`,
      ``,
      `Task: ${input.task.id}`,
      `Summary: ${input.task.plan?.summary || "—"}`,
      `Retries used: ${input.task.retries}`,
      `Reason: ${input.reason}`,
      ``,
      `Last 5 log entries:`,
      ...(input.task.logs || [])
        .slice(-5)
        .map((l) => `  ${l.timestamp} [${l.level}] ${l.message}`),
    ].join("\n");
    return this.dispatch({ subject, body, kind: "task_blocked" });
  }

  static async sendLogAlert(input: LogAlertInput): Promise<SendResult> {
    const key = input.event;
    const now = Date.now();
    const last = lastLogAlertAt.get(key) || 0;
    if (now - last < LOG_RATE_LIMIT_MS) {
      return {
        delivered: false,
        channel: "log_fallback",
        detail: "rate-limited (suppressed duplicate within 5 min)",
      };
    }
    lastLogAlertAt.set(key, now);

    const subject = `[ZAR] Error event — ${input.event}`;
    const body = [
      `Runtime error event captured.`,
      ``,
      `Event: ${input.event}`,
      `Detail: ${input.detail || "—"}`,
      ``,
      `Context:`,
      input.context ? JSON.stringify(input.context, null, 2) : "  (none)",
      ``,
      `Note: rate-limited to one email per 5 minutes per event type.`,
    ].join("\n");
    return this.dispatch({ subject, body, kind: "log_alert" });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal dispatch
  // ─────────────────────────────────────────────────────────────────────

  private static async dispatch(payload: {
    subject: string;
    body: string;
    kind: string;
  }): Promise<SendResult> {
    const settings = await loadAdminSettings();
    const email = settings.integrations.email;

    const ready =
      email.enabled &&
      !!email.smtpHost &&
      !!email.smtpPort &&
      !!email.fromAddress &&
      !!email.username &&
      !!email.password;

    if (!ready) {
      return this.logFallback(payload, "smtp_not_configured");
    }

    try {
      const nodemailer: any = await this.loadNodemailer();
      if (!nodemailer) {
        return this.logFallback(payload, "nodemailer_missing");
      }

      const transporter = nodemailer.createTransport({
        host: email.smtpHost,
        port: email.smtpPort,
        secure: email.smtpPort === 465,
        auth: { user: email.username, pass: email.password },
      });

      await transporter.sendMail({
        from: email.fromName ? `"${email.fromName}" <${email.fromAddress}>` : email.fromAddress,
        to: ADMIN_EMAIL,
        subject: payload.subject,
        text: payload.body,
      });

      await logRuntimeEvent({
        level: "info",
        source: "server",
        event: `alert.${payload.kind}.sent`,
        detail: `Alert emailed to ${ADMIN_EMAIL} from ${email.fromAddress}`,
      });

      return {
        delivered: true,
        channel: "smtp",
        detail: `Sent via ${email.smtpHost}`,
      };
    } catch (err: any) {
      await logRuntimeEvent({
        level: "warn",
        source: "server",
        event: `alert.${payload.kind}.smtp_failed`,
        detail: err?.message || String(err),
      });
      return this.logFallback(payload, `smtp_failed:${err?.message || "unknown"}`);
    }
  }

  private static async logFallback(
    payload: { subject: string; body: string; kind: string },
    reason: string,
  ): Promise<SendResult> {
    const banner = [
      "",
      "================================================================",
      `  ZAR ADMIN ALERT (email fell back to logging)`,
      "----------------------------------------------------------------",
      `  to       : ${ADMIN_EMAIL}`,
      `  kind     : ${payload.kind}`,
      `  reason   : ${reason}`,
      `  subject  : ${payload.subject}`,
      `----------------------------------------------------------------`,
      payload.body,
      "================================================================",
      "",
    ].join("\n");
    console.log(banner);
    await logRuntimeEvent({
      level: "warn",
      source: "server",
      event: `alert.${payload.kind}.log_fallback`,
      detail: `${payload.subject} (${reason})`,
    });
    return {
      delivered: false,
      channel: "log_fallback",
      detail: `Alert written to runtime log (${reason}).`,
    };
  }

  private static async loadNodemailer(): Promise<any | null> {
    try {
      // @ts-ignore — optional runtime dep, see AdminEmailSender for the same pattern.
      const mod = await import("nodemailer");
      return (mod as any).default || mod;
    } catch {
      return null;
    }
  }
}

function truncate(value: string, max: number): string {
  if (!value) return value;
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export default AdminAlertSender;
