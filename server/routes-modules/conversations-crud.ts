import type { Express, Response } from "express";

import { isAuthenticated } from "../localAuth";
import { storage } from "../storage/databaseStorage";
import { upload } from "../services/fileProcessor";
import { processFile, cleanupFile } from "../services/fileProcessor";
import { DocumentIntelligenceService } from "../services/intelligence-core/DocumentIntelligenceService";
import {
  insertConversationSchema,
  insertFileSchema,
  insertMessageSchema,
  insertSessionSchema,
  users,
} from "../../shared/schema";
import { db } from "../db";
import { logRuntimeEvent } from "../services/RuntimeLogger";
import { logSecurityEvent } from "../services/SecurityAudit";
import { getActiveProviderDefaultModel } from "../core/providers/provider-config";

/**
 * Conversation CRUD + per-conversation files/upload + the messages
 * list endpoint.
 */

/** Used by every handler that takes :id — fetches the conversation,
 *  404s if missing, and returns it. Mirrors the helper that used to
 *  live in routes.ts. */
export async function requireConversation(req: any, res: Response) {
  const conversation = await storage.getConversation(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return null;
  }
  return conversation;
}

export async function requireOwnedConversation(req: any, res: Response) {
  const conversation = await requireConversation(req, res);
  if (!conversation) return null;
  if (conversation.userId !== req.user?.claims?.sub) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return conversation;
}

/** Wraps the users-table upsert in a try/catch — see /api/conversations
 *  create handler for why this is non-fatal. */
export async function ensureSessionUserInDatabase(req: any): Promise<void> {
  if (!db) return;
  const sessionUserId = req.user?.claims?.sub;
  if (!sessionUserId) return;
  const sessionUser = req.session?.user || {};
  const claims = req.user?.claims || {};
  try {
    await db
      .insert(users)
      .values({
        id: sessionUserId,
        email: sessionUser.email || claims.email || null,
        firstName: sessionUser.firstName || claims.first_name || claims.firstName || null,
        lastName: sessionUser.lastName || claims.last_name || claims.lastName || null,
        profileImageUrl:
          sessionUser.profileImageUrl ||
          claims.profile_image_url ||
          claims.profileImageUrl ||
          claims.picture ||
          null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sessionUser.email || claims.email || null,
          firstName: sessionUser.firstName || claims.first_name || claims.firstName || null,
          lastName: sessionUser.lastName || claims.last_name || claims.lastName || null,
          profileImageUrl:
            sessionUser.profileImageUrl ||
            claims.profile_image_url ||
            claims.profileImageUrl ||
            claims.picture ||
            null,
          updatedAt: new Date(),
        },
      });
  } catch (err: any) {
    const cause: any = err?.cause || err?.original || err;
    void logRuntimeEvent({
      level: "warn",
      source: "server",
      event: "user.upsert.failed",
      detail: cause?.message || err?.message || String(err),
      context: {
        userId: sessionUserId,
        email: sessionUser.email || claims.email || null,
        errorKind: err?.constructor?.name,
        pgCode: cause?.code,
        pgConstraint: cause?.constraint,
        pgDetail: cause?.detail,
        pgTable: cause?.table,
      },
    });
  }
}

export function registerConversationCrudRoutes(app: Express): void {
  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const conversations = await storage.getConversationsByUser(req.user.claims.sub);
      res.json(conversations.filter((conversation) => conversation.isActive !== false));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/archived", isAuthenticated, async (req: any, res) => {
    try {
      const conversations = await storage.getConversationsByUser(req.user.claims.sub);
      res.json({
        conversations: conversations.filter((conversation) => conversation.isActive === false),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch archived conversations" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await ensureSessionUserInDatabase(req);
      const conversation = await storage.createConversation(
        insertConversationSchema.parse({
          userId,
          title: req.body.title || "New Chat",
          mode: req.body.mode || "chat",
          model: req.body.model || getActiveProviderDefaultModel(),
          isActive: true,
        }),
      );
      try {
        await storage.createSession(
          insertSessionSchema.parse({ conversationId: conversation.id, userId }),
        );
      } catch (sessionError) {
        console.warn("[Conversations] Session creation failed (non-fatal):", sessionError);
      }
      res.json(conversation);
    } catch (err: any) {
      const detail = err?.message || String(err);
      console.error("[POST /api/conversations] failed:", err);
      await logRuntimeEvent({
        level: "error",
        source: "server",
        event: "conversation.create.failed",
        detail,
        context: {
          userId: req.user?.claims?.sub,
          mode: req.body?.mode,
          errorKind: err?.constructor?.name,
          stack: err?.stack?.split("\n").slice(0, 4).join(" | "),
        },
      });
      res.status(500).json({ error: detail || "Failed to create conversation" });
    }
  });

  app.post("/api/conversations/:id/archive", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await requireOwnedConversation(req, res);
      if (!conversation) return;
      const updated = await storage.updateConversation(req.params.id, { isActive: false });
      res.json({ conversation: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to archive conversation" });
    }
  });

  app.post("/api/conversations/:id/restore", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await requireOwnedConversation(req, res);
      if (!conversation) return;
      const updated = await storage.updateConversation(req.params.id, { isActive: true });
      res.json({ conversation: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to restore conversation" });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await requireOwnedConversation(req, res);
      if (!conversation) return;
      res.json(conversation);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.patch("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await requireOwnedConversation(req, res);
      if (!conversation) return;
      res.json(await storage.updateConversation(req.params.id, req.body));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  app.delete("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await requireOwnedConversation(req, res);
      if (!conversation) return;
      await storage.deleteConversation(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.delete("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || "user_001";
      const all = await storage.getConversationsByUser(userId);
      let deleted = 0;
      for (const conv of all) {
        try {
          await storage.deleteConversation(conv.id);
          deleted++;
        } catch {
          /* skip one bad row, keep going */
        }
      }
      await logSecurityEvent({
        type: "data.clear_all",
        userId,
        detail: `Cleared ${deleted} conversations`,
      });
      res.json({ success: true, deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await requireOwnedConversation(req, res);
      if (!conversation) return;
      res.json(await storage.getMessagesByConversation(req.params.id));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/conversations/:id/files", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await requireOwnedConversation(req, res);
      if (!conversation) return;
      res.json(await storage.getFilesByConversation(req.params.id));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.post(
    "/api/conversations/:id/upload",
    isAuthenticated,
    upload.array("files"),
    async (req: any, res) => {
      try {
        const conversationId = req.params.id;
        const conversation = await requireOwnedConversation(req, res);
        const files = req.files as any[];
        if (!conversation) {
          await Promise.allSettled((files || []).map((file) => cleanupFile(file.path)));
          return;
        }
        if (!files || files.length === 0) {
          return res.status(400).json({ error: "No files uploaded" });
        }
        const readyFiles: Array<{ file: any; processed: Awaited<ReturnType<typeof processFile>> }> = [];
        const failures: Array<{ fileName: string; error: string }> = [];

        for (const file of files) {
          try {
            const processed = await processFile(file.path, file.mimetype, file.originalname);
            if (processed.error) {
              failures.push({ fileName: file.originalname, error: processed.error });
            } else {
              readyFiles.push({ file, processed });
            }
          } catch (err: any) {
            failures.push({
              fileName: file.originalname,
              error: err?.message || "File processing failed.",
            });
          } finally {
            await cleanupFile(file.path);
          }
        }

        if (failures.length > 0) {
          return res.status(422).json({
            error: failures.map((failure) => `${failure.fileName}: ${failure.error}`).join(" "),
            failures,
          });
        }

        const processedFiles = [];
        const warnings: Array<{ fileName: string; warning: string }> = [];
        for (const { file, processed } of readyFiles) {
            // Document Intelligence — push the extracted content through
            // the Knowledge Ingestion pipeline so the upload becomes
            // connected, queryable graph knowledge instead of one-shot
            // prompt text. Best-effort: a failure here must not fail the
            // upload, so the summary is embedded when it succeeds.
            let documentIntelligence: any;
            if (!processed.error && processed.extractedContent) {
              documentIntelligence = await DocumentIntelligenceService.ingestUploadedFile({
                originalName: file.originalname,
                fileName: file.filename,
                mimeType: processed.mimeType,
                content: String(processed.extractedContent),
                conversationId,
                userId: req.user?.claims?.sub,
              }).catch((err: any) => ({ ingested: false, skippedReason: String(err?.message || err) }));
              if (documentIntelligence?.ingested === false) {
                warnings.push({
                  fileName: file.originalname,
                  warning: documentIntelligence.skippedReason || "Document ingestion failed.",
                });
              }
            }

            const saved = await storage.createFile(
              insertFileSchema.parse({
                conversationId,
                fileName: file.filename,
                originalName: file.originalname,
                mimeType: processed.mimeType,
                size: file.size,
                status: processed.error ? "error" : "completed",
                extractedContent: processed.extractedContent,
                analysis: documentIntelligence
                  ? { ...(processed.analysis || {}), documentIntelligence }
                  : processed.analysis,
              }),
            );
            processedFiles.push(saved);
        }
        res.json({ conversationId, files: processedFiles, warnings });
      } catch (error: any) {
        console.error(error);
        const files = (req.files as any[] | undefined) || [];
        await Promise.allSettled(files.map((file) => cleanupFile(file.path)));
        res.status(500).json({ error: error?.message || "Upload failed" });
      }
    },
  );
}
