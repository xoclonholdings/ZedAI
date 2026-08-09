import type { Express, Request, Response } from "express";

import { isAuthenticated } from "../../localAuth";
import { ownerContextFromAuthenticatedRequest } from "../auth/OwnerContext";
import { logRuntimeEvent } from "../RuntimeLogger";
import { hashNetworkValue } from "./phoneSecurity";
import { SmsGateway } from "./SmsGateway";
import { SmsStore } from "./SmsStore";
import { TelnyxSmsProvider } from "./TelnyxSmsProvider";
import { DEFAULT_SMS_PERMISSIONS, type SmsPermissions } from "./types";

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

function allowed(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function rawBody(req: Request): string {
  return typeof (req as any).rawBody === "string" ? (req as any).rawBody : "";
}

function safePermissions(value: unknown): SmsPermissions {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_SMS_PERMISSIONS).map(([key, fallback]) => [key, typeof input[key] === "boolean" ? input[key] : fallback]),
  ) as SmsPermissions;
}

export function registerSmsRoutes(app: Express): void {
  const store = new SmsStore();
  const provider = new TelnyxSmsProvider();
  const gateway = new SmsGateway(provider, store);

  app.post("/api/sms/webhooks/telnyx", async (req: Request, res: Response) => {
    if (!allowed(`webhook-ip:${req.ip}`, 60, 60_000)) return res.sendStatus(429);
    if (!provider.verifyWebhook(rawBody(req), req.headers)) {
      void logRuntimeEvent({ level: "warn", source: "server", event: "sms.webhook.signature_rejected", context: { provider: "telnyx" } });
      return res.sendStatus(401);
    }
    const delivery = provider.parseDeliveryUpdate(req.body);
    if (delivery) {
      await store.updateDelivery(provider.name, delivery.providerMessageId, delivery.status).catch(() => undefined);
      return res.sendStatus(202);
    }
    const inbound = provider.parseInbound(req.body);
    if (!inbound) return res.sendStatus(202);
    if (!allowed(`webhook-phone:${inbound.from}`, 20, 60_000)) return res.sendStatus(429);
    const accepted = await gateway.acceptInbound(inbound);
    if (accepted.processing) void accepted.processing;
    return res.status(accepted.duplicate ? 200 : 202).json({ accepted: true, duplicate: accepted.duplicate });
  });

  app.get("/api/sms/connection", isAuthenticated, async (req: any, res: Response) => {
    try {
      const owner = ownerContextFromAuthenticatedRequest(req);
      const connection = await store.getConnectionForUser(owner.ownerUserId);
      const events = await store.listEvents(owner.ownerUserId, 20);
      return res.json({
        active: connection?.status === "active",
        status: connection?.status || "not_connected",
        phoneLastFour: connection?.phoneLastFour || null,
        permissions: connection?.permissions || DEFAULT_SMS_PERMISSIONS,
        consentedAt: connection?.consentedAt || null,
        policyVersion: connection?.policyVersion || "zar-by-text-v1",
        recentSecurityActivity: events,
      });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "ZAR by Text is unavailable" });
    }
  });

  app.post("/api/sms/connection/challenge", isAuthenticated, async (req: any, res: Response) => {
    try {
      const owner = ownerContextFromAuthenticatedRequest(req);
      if (!allowed(`challenge-user:${owner.ownerUserId}`, 3, 60 * 60_000) || !allowed(`challenge-ip:${req.ip}`, 10, 60 * 60_000)) {
        return res.status(429).json({ error: "Please wait before requesting another code" });
      }
      const result = await gateway.startVerification({
        userId: owner.ownerUserId,
        phone: req.body?.phone,
        permissions: safePermissions(req.body?.permissions),
      });
      const secret = process.env.SMS_ENCRYPTION_KEY || "";
      await store.recordEvent({
        userId: owner.ownerUserId,
        type: "sms.connection.requested",
        phoneLastFour: result.phoneLastFour,
        ipHash: hashNetworkValue(req.ip, secret),
        userAgentHash: hashNetworkValue(req.headers["user-agent"], secret),
      });
      return res.status(202).json(result);
    } catch {
      return res.status(400).json({ error: "The verification request could not be completed" });
    }
  });

  app.post("/api/sms/connection/verify", isAuthenticated, async (req: any, res: Response) => {
    try {
      const owner = ownerContextFromAuthenticatedRequest(req);
      if (!allowed(`verify-user:${owner.ownerUserId}`, 10, 15 * 60_000)) {
        return res.status(429).json({ error: "Verification could not be completed" });
      }
      const connection = await gateway.verify({
        userId: owner.ownerUserId,
        challengeId: String(req.body?.challengeId || ""),
        code: String(req.body?.code || ""),
      });
      return res.json({ active: true, status: connection.status, phoneLastFour: connection.phoneLastFour, permissions: connection.permissions });
    } catch {
      return res.status(400).json({ error: "Verification could not be completed" });
    }
  });

  app.put("/api/sms/connection/permissions", isAuthenticated, async (req: any, res: Response) => {
    try {
      const owner = ownerContextFromAuthenticatedRequest(req);
      const connection = await store.getConnectionForUser(owner.ownerUserId);
      if (!connection) return res.status(404).json({ error: "No phone connection" });
      const permissions = safePermissions(req.body?.permissions);
      await store.updatePermissions(connection.id, owner.ownerUserId, permissions);
      await store.recordEvent({ userId: owner.ownerUserId, connectionId: connection.id, type: "sms.permissions.updated", phoneLastFour: connection.phoneLastFour });
      return res.json({ permissions });
    } catch {
      return res.status(400).json({ error: "Permissions could not be updated" });
    }
  });

  app.delete("/api/sms/connection", isAuthenticated, async (req: any, res: Response) => {
    try {
      const owner = ownerContextFromAuthenticatedRequest(req);
      const connection = await store.getConnectionForUser(owner.ownerUserId);
      if (connection) {
        await store.setConnectionStatus(connection.id, "revoked");
        await store.recordEvent({ userId: owner.ownerUserId, connectionId: connection.id, type: "sms.connection.revoked", phoneLastFour: connection.phoneLastFour });
      }
      return res.status(204).send();
    } catch {
      return res.status(400).json({ error: "Connection could not be revoked" });
    }
  });
}

export default registerSmsRoutes;
