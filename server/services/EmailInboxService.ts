import fs from "fs/promises";
import path from "path";

import { loadAdminSettings } from "./AdminSettingsStore";
import { logRuntimeEvent } from "./RuntimeLogger";
import {
  EmailInboxWatchdog,
  type InboxFinding,
  type InboxMessage,
} from "./workflow/EmailInboxWatchdog";
import { HUB_SHARED_MEMORY_DIR } from "../utils/repoPaths";

export interface EmailInboxStatus {
  address: string;
  connected: boolean;
  provider: "gmail" | "intake" | "smtp-outbound-only" | "unconfigured";
  detail: string;
}

export interface EmailInboxResponse {
  status: EmailInboxStatus;
  messages: InboxMessage[];
  findings: InboxFinding[];
}

interface StoredEmailMessage extends InboxMessage {
  message_id?: string;
  source: "intake" | "gmail";
}

const DEFAULT_INBOX_ADDRESS = "zed@zed-ai.online";
const INBOX_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "email-inbox");
const INBOX_MESSAGES_PATH = path.resolve(INBOX_DIR, "messages.json");

export class EmailInboxService {
  static targetAddress(): string {
    return (process.env.ZED_INBOX_ADDRESS || DEFAULT_INBOX_ADDRESS).trim().toLowerCase();
  }

  static async recordIncoming(input: {
    from: string;
    subject?: string;
    body?: string;
    message_id?: string;
    user_id?: string;
    received_at?: string;
  }): Promise<StoredEmailMessage> {
    const message: StoredEmailMessage = {
      id: input.message_id || `intake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message_id: input.message_id,
      account_id: this.targetAddress(),
      sender: input.from,
      subject: input.subject || "(no subject)",
      body: input.body || "",
      received_at: input.received_at || new Date().toISOString(),
      source: "intake",
    };

    const existing = await this.readStoredMessages();
    const next = [
      message,
      ...existing.filter((item) =>
        message.message_id ? item.message_id !== message.message_id : item.id !== message.id,
      ),
    ].slice(0, 500);
    await this.writeStoredMessages(next);
    return message;
  }

  static async listInbox(limit = 50): Promise<EmailInboxResponse> {
    const target = this.targetAddress();
    const settings = await loadAdminSettings();
    const googleAccount = (settings.integrations.google.accounts || []).find((account) => {
      const emailMatches = account.email?.trim().toLowerCase() === target;
      const hasGmailScope = (account.scopes || []).some((scope) => /gmail/i.test(scope));
      return emailMatches && hasGmailScope && account.clientId && account.clientSecret && account.refreshToken;
    });
    const emailAccount = (settings.integrations.email.accounts || []).find(
      (account) => account.fromAddress?.trim().toLowerCase() === target,
    );

    const storedMessages = await this.readStoredMessages();
    let liveMessages: InboxMessage[] = [];
    let status: EmailInboxStatus = {
      address: target,
      connected: storedMessages.length > 0,
      provider: storedMessages.length > 0 ? "intake" : "unconfigured",
      detail: storedMessages.length > 0
        ? "Showing messages received through /api/intake/email."
        : "No inbound mailbox is configured yet.",
    };

    if (googleAccount) {
      try {
        liveMessages = await this.fetchGmailMessages(googleAccount, limit);
        status = {
          address: target,
          connected: true,
          provider: "gmail",
          detail: "Connected through Google Gmail API.",
        };
      } catch (err: any) {
        status = {
          address: target,
          connected: storedMessages.length > 0,
          provider: storedMessages.length > 0 ? "intake" : "gmail",
          detail: `Gmail connection failed: ${err?.message || "unknown error"}`,
        };
        await logRuntimeEvent({
          level: "warn",
          source: "server",
          event: "email.inbox.gmail_failed",
          detail: err?.message || String(err),
        });
      }
    } else if (emailAccount) {
      status = {
        address: target,
        connected: storedMessages.length > 0,
        provider: storedMessages.length > 0 ? "intake" : "smtp-outbound-only",
        detail: "SMTP is configured for outbound mail only. Connect Google Gmail or forward inbound mail to /api/intake/email to read messages.",
      };
    }

    const messages = dedupeMessages([...liveMessages, ...storedMessages])
      .sort((a, b) => Number(new Date(b.received_at)) - Number(new Date(a.received_at)))
      .slice(0, limit);
    const findings = await EmailInboxWatchdog.inspect(messages);
    return { status, messages, findings };
  }

  private static async readStoredMessages(): Promise<StoredEmailMessage[]> {
    try {
      const raw = await fs.readFile(INBOX_MESSAGES_PATH, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private static async writeStoredMessages(messages: StoredEmailMessage[]): Promise<void> {
    await fs.mkdir(INBOX_DIR, { recursive: true });
    await fs.writeFile(INBOX_MESSAGES_PATH, `${JSON.stringify(messages, null, 2)}\n`, "utf8");
  }

  private static async fetchGmailMessages(
    account: { clientId: string; clientSecret: string; refreshToken: string; email: string },
    limit: number,
  ): Promise<InboxMessage[]> {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: account.clientId,
        client_secret: account.clientSecret,
        refresh_token: account.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenRes.ok) throw new Error(`token HTTP ${tokenRes.status}`);
    const tokenBody = await tokenRes.json() as { access_token?: string };
    if (!tokenBody.access_token) throw new Error("Google token response did not include access_token");

    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("maxResults", String(Math.min(Math.max(limit, 1), 50)));
    listUrl.searchParams.set("q", "in:anywhere newer_than:30d");

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });
    if (!listRes.ok) throw new Error(`gmail list HTTP ${listRes.status}`);
    const listBody = await listRes.json() as { messages?: Array<{ id: string }> };

    const messages = await Promise.all(
      (listBody.messages || []).slice(0, limit).map(async (item) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
          { headers: { Authorization: `Bearer ${tokenBody.access_token}` } },
        );
        if (!msgRes.ok) throw new Error(`gmail message HTTP ${msgRes.status}`);
        const payload = await msgRes.json() as any;
        const headers = new Map<string, string>(
          (payload.payload?.headers || []).map((header: any) => [
            String(header.name || "").toLowerCase(),
            String(header.value || ""),
          ]),
        );
        return {
          id: `gmail-${payload.id}`,
          account_id: account.email,
          sender: headers.get("from") || "unknown sender",
          subject: headers.get("subject") || "(no subject)",
          body: extractGmailBody(payload.payload) || payload.snippet || "",
          received_at: new Date(Number(payload.internalDate || Date.now())).toISOString(),
          flags: {
            starred: Array.isArray(payload.labelIds) && payload.labelIds.includes("STARRED"),
            important: Array.isArray(payload.labelIds) && payload.labelIds.includes("IMPORTANT"),
          },
        } satisfies InboxMessage;
      }),
    );
    return messages;
  }
}

function dedupeMessages(messages: InboxMessage[]): InboxMessage[] {
  const seen = new Set<string>();
  const result: InboxMessage[] = [];
  for (const message of messages) {
    const key = `${message.id}:${message.sender}:${message.subject}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(message);
  }
  return result;
}

function extractGmailBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  const plain = parts.find((part: any) => part.mimeType === "text/plain" && part.body?.data);
  if (plain) return decodeBase64Url(plain.body.data);
  for (const part of parts) {
    const nested = extractGmailBody(part);
    if (nested) return nested;
  }
  return "";
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}
