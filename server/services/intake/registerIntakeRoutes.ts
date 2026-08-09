/**
 * registerIntakeRoutes
 *
 * Adds the additive HTTP surface for the universal external command
 * intake layer. No existing routes are touched.
 *
 * All endpoints are namespaced under /api/intake so they cannot collide
 * with the existing surface.
 *
 * Webhook-style endpoints are called by external providers and require
 * timestamped HMAC verification plus replay protection. They remain
 * unrouted until a verified external Identity binding exists. App-level
 * endpoints use the authenticated OwnerContext contract.
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated, isAdmin } from "../../localAuth";
import { ExternalCommandGateway } from "./ExternalCommandGateway";
import { ChannelContextManager, type ChannelType } from "./ChannelContextManager";
import { VoiceCommandBridge } from "./VoiceCommandBridge";
import { MessagingBridge } from "./MessagingBridge";
import { logRuntimeEvent } from "../RuntimeLogger";
import {
  OwnerContextError,
  ownerContextFromAuthenticatedRequest,
} from "../auth/OwnerContext";
import { verifySignedIntakeRequest } from "./IntakeWebhookAuthenticity";

async function acknowledgeUnboundExternalMessage(
  req: Request,
  res: Response,
  channel: string,
): Promise<Response> {
  void logRuntimeEvent({
    level: "info",
    source: "server",
    event: "intake.external.unrouted",
    detail: `Authenticated ${channel} intake requires an Identity binding`,
    context: {
      channel,
      messageId: req.headers["x-zar-message-id"],
    },
  });
  return res.status(202).json({
    accepted: true,
    routed: false,
    reason: "Verified Identity binding required",
  });
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
      const owner_context = ownerContextFromAuthenticatedRequest(req);
      const result = await ExternalCommandGateway.receive({
        channel: (channel as ChannelType) || "app_chat",
        sender_id: sender_id || owner_context.ownerUserId,
        message,
        metadata,
        timestamp,
        owner_context,
        conversation_id: conversation_id || null,
      });
      res.json(result);
    } catch (err: any) {
      if (err instanceof OwnerContextError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
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
      const owner = ownerContextFromAuthenticatedRequest(req);
      const ctx = await ChannelContextManager.get(owner.ownerUserId);
      res.json({ context: ctx });
    } catch (err: any) {
      if (err instanceof OwnerContextError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: err?.message || "fetch failed" });
    }
  });

  app.get("/api/intake/context/:user_id", isAdmin, async (req: any, res: Response) => {
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
      const owner = ownerContextFromAuthenticatedRequest(req);
      const { channel } = req.body || {};
      if (!channel) return res.status(400).json({ error: "channel is required" });
      const ctx = await ChannelContextManager.setActiveChannel(owner.ownerUserId, channel);
      res.json({ context: ctx });
    } catch (err: any) {
      if (err instanceof OwnerContextError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: err?.message || "update failed" });
    }
  });

  // ─── External provider webhooks ───────────────────────────────────────────

  app.post("/api/intake/webhook", verifySignedIntakeRequest, async (req: Request, res: Response) => {
    try {
      const { channel, sender_id, message } = req.body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" });
      }
      void sender_id;
      return acknowledgeUnboundExternalMessage(req, res, channel || "webhook");
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "webhook failed" });
    }
  });

  app.post("/api/intake/email", verifySignedIntakeRequest, async (req: Request, res: Response) => {
    try {
      const { from, subject, body } = req.body || {};
      if (!from || (!body && !subject)) {
        return res.status(400).json({ error: "from and body/subject are required" });
      }
      return acknowledgeUnboundExternalMessage(req, res, "email");
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "email intake failed" });
    }
  });

  app.post("/api/intake/sms", verifySignedIntakeRequest, async (req: Request, res: Response) => {
    try {
      const { from, body } = req.body || {};
      if (!from || !body) {
        return res.status(400).json({ error: "from and body are required" });
      }
      return acknowledgeUnboundExternalMessage(req, res, "sms");
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "sms intake failed" });
    }
  });

  app.post("/api/intake/messaging", verifySignedIntakeRequest, async (req: Request, res: Response) => {
    try {
      const { target, from, body } = req.body || {};
      if (!target || !from || !body) {
        return res.status(400).json({ error: "target, from, body are required" });
      }
      return acknowledgeUnboundExternalMessage(req, res, target);
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
      void metadata;
      return res.status(409).json({
        error: "Outbound messaging requires an action-specific approved execution path",
      });
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

  app.post("/api/intake/voice", verifySignedIntakeRequest, async (req: Request, res: Response) => {
    try {
      const { transcript, speaker_id } = req.body || {};
      if (!transcript || !speaker_id) {
        return res.status(400).json({ error: "transcript and speaker_id are required" });
      }
      return acknowledgeUnboundExternalMessage(req, res, "voice");
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
