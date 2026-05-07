/**
 * registerIntakeRoutes
 *
 * Adds the additive HTTP surface for the universal external command
 * intake layer. No existing routes are touched.
 *
 * All endpoints are namespaced under /api/intake so they cannot collide
 * with the existing surface.
 *
 * Webhook-style endpoints (POST /api/intake/webhook, /api/intake/email,
 * /api/intake/sms, /api/intake/whatsapp) are intentionally unauthenticated
 * because they are called by external providers; they rely on a shared
 * secret (INTAKE_WEBHOOK_SECRET) when one is configured. App-level
 * endpoints (/api/intake/command, /api/intake/context/*) are gated by
 * the existing isAuthenticated middleware so behavior matches the rest
 * of Zed's auth model.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { isAuthenticated, isAdmin } from "../../localAuth";
import { ExternalCommandGateway } from "./ExternalCommandGateway";
import { ChannelContextManager, type ChannelType } from "./ChannelContextManager";
import { VoiceCommandBridge } from "./VoiceCommandBridge";
import { MessagingBridge, type MessagingTarget } from "./MessagingBridge";
import { logRuntimeEvent } from "../RuntimeLogger";

function userIdFrom(req: any): string | null {
  return req?.user?.claims?.sub || req?.session?.userId || null;
}

/**
 * Lightweight shared-secret check for webhook endpoints. When the env
 * var is unset the check is permissive so local development still
 * works; when set, callers must include the matching value via the
 * X-Zed-Intake-Secret header or `secret` query param.
 */
function verifyIntakeSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INTAKE_WEBHOOK_SECRET;
  if (!expected) return next();
  const provided =
    (req.headers["x-zed-intake-secret"] as string | undefined) ||
    (req.query.secret as string | undefined);
  if (provided && provided === expected) return next();
  void logRuntimeEvent({
    level: "warn",
    source: "server",
    event: "intake.webhook.rejected",
    detail: `Rejected ${req.method} ${req.originalUrl} — bad/missing intake secret`,
  });
  return res.status(401).json({ error: "Invalid intake secret" });
}

export function registerIntakeRoutes(app: Express): void {
  // ─── Authenticated app-level intake ───────────────────────────────────────

  app.post("/api/intake/command", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { channel, sender_id, message, metadata, timestamp, conversation_id } =
        req.body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" });
      }
      const user_id = userIdFrom(req);
      const result = await ExternalCommandGateway.receive({
        channel: (channel as ChannelType) || "app_chat",
        sender_id: sender_id || user_id || "unknown",
        message,
        metadata,
        timestamp,
        user_id: user_id || undefined,
        conversation_id: conversation_id || null,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "intake failed" });
    }
  });

  app.post("/api/intake/preview", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { channel, message } = req.body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" });
      }
      const normalized = ExternalCommandGateway.normalize(
        message,
        (channel as ChannelType) || "unknown",
      );
      res.json({ normalized });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "preview failed" });
    }
  });

  app.get("/api/intake/recent", isAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const entries = await ExternalCommandGateway.listRecent(limit);
      res.json({ entries });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "list failed" });
    }
  });

  // ─── Cross-channel context ────────────────────────────────────────────────

  app.get("/api/intake/context/me", isAuthenticated, async (req: any, res: Response) => {
    try {
      const user_id = userIdFrom(req);
      if (!user_id) return res.status(401).json({ error: "Unauthenticated" });
      const ctx = await ChannelContextManager.get(user_id);
      res.json({ context: ctx });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "fetch failed" });
    }
  });

  app.get("/api/intake/context/:user_id", isAdmin, async (req: Request, res: Response) => {
    try {
      const ctx = await ChannelContextManager.get(req.params.user_id);
      if (!ctx) return res.status(404).json({ error: "context not found" });
      res.json({ context: ctx });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "fetch failed" });
    }
  });

  app.get("/api/intake/contexts", isAdmin, async (req: Request, res: Response) => {
    try {
      const channel = typeof req.query.channel === "string"
        ? (req.query.channel as ChannelType)
        : undefined;
      const has_task_id = typeof req.query.task_id === "string"
        ? (req.query.task_id as string)
        : undefined;
      const items = await ChannelContextManager.list({ channel, has_task_id });
      res.json({ contexts: items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "list failed" });
    }
  });

  app.post("/api/intake/context/active", isAuthenticated, async (req: any, res: Response) => {
    try {
      const user_id = userIdFrom(req);
      const { channel } = req.body || {};
      if (!user_id) return res.status(401).json({ error: "Unauthenticated" });
      if (!channel) return res.status(400).json({ error: "channel is required" });
      const ctx = await ChannelContextManager.setActiveChannel(user_id, channel);
      res.json({ context: ctx });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "update failed" });
    }
  });

  // ─── External provider webhooks ───────────────────────────────────────────

  app.post("/api/intake/webhook", verifyIntakeSecret, async (req: Request, res: Response) => {
    try {
      const { channel, sender_id, message, metadata, timestamp, user_id } =
        req.body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" });
      }
      const result = await ExternalCommandGateway.receive({
        channel: (channel as ChannelType) || "webhook",
        sender_id: sender_id || "webhook",
        message,
        metadata,
        timestamp,
        user_id,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "webhook failed" });
    }
  });

  app.post("/api/intake/email", verifyIntakeSecret, async (req: Request, res: Response) => {
    try {
      const { from, subject, body, message_id, user_id } = req.body || {};
      if (!from || (!body && !subject)) {
        return res.status(400).json({ error: "from and body/subject are required" });
      }
      const message = `${subject ? `Subject: ${subject}\n\n` : ""}${body || ""}`.trim();
      const result = await ExternalCommandGateway.receive({
        channel: "email",
        sender_id: from,
        message,
        metadata: { subject, message_id },
        user_id,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "email intake failed" });
    }
  });

  app.post("/api/intake/sms", verifyIntakeSecret, async (req: Request, res: Response) => {
    try {
      const { from, body, message_id, user_id } = req.body || {};
      if (!from || !body) {
        return res.status(400).json({ error: "from and body are required" });
      }
      const result = await MessagingBridge.routeIncoming({
        target: "sms",
        sender_id: from,
        body,
        metadata: { message_id },
        user_id,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "sms intake failed" });
    }
  });

  app.post("/api/intake/messaging", verifyIntakeSecret, async (req: Request, res: Response) => {
    try {
      const { target, from, body, metadata, user_id } = req.body || {};
      if (!target || !from || !body) {
        return res.status(400).json({ error: "target, from, body are required" });
      }
      const result = await MessagingBridge.routeIncoming({
        target: target as MessagingTarget,
        sender_id: from,
        body,
        metadata,
        user_id,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "messaging intake failed" });
    }
  });

  app.post("/api/intake/messaging/send", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { target, to, body, metadata } = req.body || {};
      if (!target || !to || !body) {
        return res.status(400).json({ error: "target, to, body are required" });
      }
      const result = await MessagingBridge.sendOutbound({
        target: target as MessagingTarget,
        to,
        body,
        metadata,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "send failed" });
    }
  });

  app.get("/api/intake/messaging/compatibility", isAuthenticated, async (_req, res: Response) => {
    try {
      res.json({ adapters: await MessagingBridge.approvalCompatibility() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "lookup failed" });
    }
  });

  // ─── Voice intake placeholder ─────────────────────────────────────────────

  app.post("/api/intake/voice", verifyIntakeSecret, async (req: Request, res: Response) => {
    try {
      const { transcript, speaker_id, confidence, detected_intent, metadata, timestamp, user_id } =
        req.body || {};
      if (!transcript || !speaker_id) {
        return res.status(400).json({ error: "transcript and speaker_id are required" });
      }
      const result = await VoiceCommandBridge.process({
        transcript,
        speaker_id,
        confidence: typeof confidence === "number" ? confidence : 1,
        detected_intent,
        metadata,
        timestamp,
        user_id,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "voice intake failed" });
    }
  });

  app.get("/api/intake/voice/contract", isAuthenticated, async (_req, res: Response) => {
    try {
      res.json(VoiceCommandBridge.describeContract());
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "lookup failed" });
    }
  });
}

export default registerIntakeRoutes;
