import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { ChatExecutionService } from "../services/ChatExecutionService";
import { requireOwnedConversation } from "./conversations-crud";

function writeSseHeaders(res: any) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
}

async function sendDone(res: any, stream: boolean, payload: any) {
  if (stream) {
    writeSseHeaders(res);
    if (payload.userMessage) {
      res.write(`data: ${JSON.stringify({ type: "user_message", message: payload.userMessage })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: "done", message: payload.aiMessage, trace: payload.trace })}\n\n`);
    res.end();
    return;
  }
  res.json(payload);
}

export function registerConversationSendRoutes(app: Express): void {
  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await requireOwnedConversation(req, res);
      if (!conversation) return;

      const conversationId = req.params.id;
      const { content, stream = true, context, projectId, workspaceId } = req.body || {};
      if (!content?.trim()) return res.status(400).json({ error: "message_required" });

      const userId = req.user?.claims?.sub || "unknown";
      const result = await ChatExecutionService.execute({
        userId,
        message: content,
        conversationId,
        route: "/api/conversations/:id/messages",
        ip: req.ip || "",
        isAdmin: Boolean(req.user?.claims?.isAdmin),
        context,
        projectId,
        workspaceId,
        persistUserMessage: true,
      });

      const aiMessage = {
        conversationId,
        role: "assistant",
        content: result.reply,
        metadata: result.metadata,
      };
      await sendDone(res, stream, { aiMessage, trace: result.trace });
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({
          error: "message_processing_failed",
          detail: error?.message || String(error),
        });
      }
    }
  });
}
