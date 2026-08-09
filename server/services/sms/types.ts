export type SmsPermission = "memory" | "knowledge" | "projects" | "reminders" | "commands";

export type SmsPermissions = Record<SmsPermission, boolean>;

export const DEFAULT_SMS_PERMISSIONS: SmsPermissions = {
  memory: true,
  knowledge: true,
  projects: true,
  reminders: true,
  commands: false,
};

export interface SmsConnection {
  id: string;
  userId: string;
  phoneHash: string;
  phoneCiphertext: string;
  phoneLastFour: string;
  status: "active" | "disabled" | "revoked";
  permissions: SmsPermissions;
  conversationId: string | null;
  consentedAt: Date;
  revokedAt: Date | null;
  policyVersion: string;
}

export interface InboundSms {
  providerMessageId: string;
  from: string;
  to: string;
  text: string;
  receivedAt: Date;
}

export interface OutboundSms {
  to: string;
  text: string;
  idempotencyKey: string;
}

export interface SmsSendResult {
  providerMessageId: string;
  status: string;
}

export interface SmsProvider {
  readonly name: string;
  verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean;
  parseInbound(payload: unknown): InboundSms | null;
  parseDeliveryUpdate(payload: unknown): { providerMessageId: string; status: string } | null;
  send(message: OutboundSms): Promise<SmsSendResult>;
}
