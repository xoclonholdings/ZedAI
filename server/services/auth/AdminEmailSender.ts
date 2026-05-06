/**
 * AdminEmailSender
 *
 * Sends one-time admin login codes via SMTP using the existing
 * EmailIntegrationSettings (provider/host/port/user/pass/from). When
 * SMTP is not configured, the code is logged to the runtime log and
 * stdout with a clearly-marked banner so the admin can recover it
 * from Render's log tail.
 *
 * `nodemailer` is loaded with a dynamic import. If the dependency is
 * missing or fails to load (for any reason), the sender silently falls
 * back to the log-only channel so the admin auth path never breaks.
 */

import { loadAdminSettings } from "../AdminSettingsStore";
import { logRuntimeEvent } from "../RuntimeLogger";

export type DeliveryChannel = "smtp" | "log_fallback";

export interface SendOtpInput {
  to: string;
  code: string;
  ttl_minutes: number;
}

export interface SendOtpResult {
  delivered: boolean;
  channel: DeliveryChannel;
  detail: string;
}

export class AdminEmailSender {
  static async sendOtp(input: SendOtpInput): Promise<SendOtpResult> {
    const settings = await loadAdminSettings();
    const email = settings.integrations.email;

    const subject = "Your ZED admin sign-in code";
    const body = this.renderBody(input.code, input.ttl_minutes);

    const smtpReady =
      email.enabled &&
      !!email.smtpHost &&
      !!email.smtpPort &&
      !!email.fromAddress &&
      !!email.username &&
      !!email.password;

    if (!smtpReady) {
      return this.logFallback(input.to, input.code, input.ttl_minutes, "smtp_not_configured");
    }

    try {
      const nodemailer: any = await this.loadNodemailer();
      if (!nodemailer) {
        return this.logFallback(input.to, input.code, input.ttl_minutes, "nodemailer_missing");
      }

      const transporter = nodemailer.createTransport({
        host: email.smtpHost,
        port: email.smtpPort,
        secure: email.smtpPort === 465,
        auth: { user: email.username, pass: email.password },
      });

      await transporter.sendMail({
        from: email.fromName ? `"${email.fromName}" <${email.fromAddress}>` : email.fromAddress,
        to: input.to,
        subject,
        text: body,
      });

      await logRuntimeEvent({
        level: "info",
        source: "server",
        event: "auth.admin.otp.sent",
        detail: `Sent OTP to ${input.to} via SMTP (${email.smtpHost})`,
      });

      return {
        delivered: true,
        channel: "smtp",
        detail: `Sent via ${email.provider} (${email.smtpHost})`,
      };
    } catch (err: any) {
      await logRuntimeEvent({
        level: "warn",
        source: "server",
        event: "auth.admin.otp.smtp_failed",
        detail: err?.message || String(err),
      });
      return this.logFallback(input.to, input.code, input.ttl_minutes, `smtp_failed:${err?.message || "unknown"}`);
    }
  }

  private static renderBody(code: string, ttl_minutes: number): string {
    return [
      `Your ZED admin sign-in code is:`,
      ``,
      `    ${code}`,
      ``,
      `This code expires in ${ttl_minutes} minutes and can only be used once.`,
      ``,
      `If you did not request this code, you can ignore this email.`,
    ].join("\n");
  }

  private static async logFallback(
    to: string,
    code: string,
    ttl_minutes: number,
    reason: string,
  ): Promise<SendOtpResult> {
    const banner = [
      "",
      "================================================================",
      "  ZED ADMIN SIGN-IN CODE (email delivery fell back to logging)",
      "----------------------------------------------------------------",
      `  recipient : ${to}`,
      `  code      : ${code}`,
      `  expires   : ${ttl_minutes} minute(s)`,
      `  reason    : ${reason}`,
      "================================================================",
      "",
    ].join("\n");
    // Print to stdout so it shows up in Render's log tail immediately.
    console.log(banner);
    await logRuntimeEvent({
      level: "warn",
      source: "server",
      event: "auth.admin.otp.log_fallback",
      detail: `OTP for ${to} written to log (${reason}) — code length ${code.length}`,
      // Intentionally do not write the code into structured context to
      // keep it out of long-term log analytics; stdout banner is enough
      // for one-off recovery.
    });
    return {
      delivered: false,
      channel: "log_fallback",
      detail: `Code written to runtime log (${reason}). Check Render log tail.`,
    };
  }

  private static async loadNodemailer(): Promise<any | null> {
    try {
      // Dynamic import so missing dep never crashes the process.
      // @ts-ignore — nodemailer is an optional runtime dep; loaded
      // lazily and tolerated when absent (we fall back to logging).
      const mod = await import("nodemailer");
      return (mod as any).default || mod;
    } catch {
      return null;
    }
  }
}

export default AdminEmailSender;
