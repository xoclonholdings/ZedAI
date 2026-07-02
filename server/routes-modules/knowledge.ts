import type { Express } from "express";

import { isAdmin, isAuthenticated } from "../localAuth";
import { KnowledgeService } from "../services/KnowledgeService";
import { KnowledgeCurationEngine } from "../services/KnowledgeCurationEngine";
import { injectMemory } from "../services/MemoryInjector";
import {
  insertProjectMemorySchema,
  insertScratchpadMemorySchema,
} from "../../shared/schema";
import { db } from "../db";
import { users } from "../../shared/schema";

/**
 * Knowledge / memory endpoints:
 *   - /api/knowledge/context  + /search          (read-only retrieval)
 *   - /api/knowledge/curation/*                  (active knowledge health)
 *   - /api/knowledge/core-memory                 (admin-only KV store)
 *   - /api/knowledge/voice-memory                (ZED voice formation)
 *   - /api/knowledge/project-memory              (per-user long-term)
 *   - /api/knowledge/personal-base               (the "profile" entry)
 *   - /api/knowledge/scratchpad                  (24h short-term notes)
 */

/** Ensures req.user maps to an actual users-table row before we
 *  insert FK-bearing memory rows that reference it. */
async function ensureSessionUserInDatabase(req: any): Promise<void> {
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
  } catch {
    // Non-fatal - see /api/conversations create handler for the
    // detailed explanation. FK violations elsewhere will surface
    // through their own catch blocks.
  }
}

export function registerKnowledgeRoutes(app: Express): void {
  app.get("/api/knowledge/context", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isAdminUser = !!req.user?.claims?.isAdmin;
      const query = String(req.query.q || "").trim();
      if (!query) return res.status(400).json({ error: "Query required" });

      const hubMemory = await injectMemory("KnowledgeContext", { includeFoundation: isAdminUser }).catch(
        () => ({ formatted: "" }),
      );
      const knowledge = await KnowledgeService.buildContext({
        userId,
        query,
        conversationId:
          typeof req.query.conversationId === "string"
            ? req.query.conversationId
            : undefined,
        lane: isAdminUser ? "admin" : "chat",
        injectedMemory: hubMemory.formatted,
        includeAdminFoundation: isAdminUser,
      });
      res.json(knowledge);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to build knowledge context" });
    }
  });

  app.get("/api/knowledge/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = String(req.query.q || "").trim();
      if (!query) return res.status(400).json({ error: "Query required" });
      const results = await KnowledgeService.search({
        userId,
        query,
        conversationId:
          typeof req.query.conversationId === "string"
            ? req.query.conversationId
            : undefined,
      });
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Knowledge search failed" });
    }
  });

  app.get("/api/knowledge/curation/latest", isAuthenticated, async (_req: any, res) => {
    try {
      const report = await KnowledgeCurationEngine.getLatestReview();
      res.json({ report });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to load curation review" });
    }
  });

  app.post("/api/knowledge/curation/review", isAuthenticated, async (req: any, res) => {
    try {
      const report = await KnowledgeCurationEngine.runReview({
        userId: req.user.claims.sub,
        trigger: req.user?.claims?.isAdmin ? "manual-admin" : "manual-user",
      });
      res.json({ report });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Knowledge curation review failed" });
    }
  });

  app.post("/api/knowledge/curation/evaluate", isAuthenticated, async (req: any, res) => {
    try {
      const evaluation = await KnowledgeCurationEngine.evaluateIncoming({
        userId: req.user.claims.sub,
        title: typeof req.body?.title === "string" ? req.body.title : undefined,
        type: typeof req.body?.type === "string" ? req.body.type : null,
        content: String(req.body?.content || ""),
      });
      res.json({ evaluation });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Knowledge evaluation failed" });
    }
  });

  app.get("/api/admin/knowledge/curation", isAdmin, async (req: any, res) => {
    try {
      const latest = await KnowledgeCurationEngine.getLatestReview();
      if (latest) return res.json({ report: latest });
      const report = await KnowledgeCurationEngine.runReview({
        userId: req.user?.claims?.sub || "admin-user",
        trigger: "admin-read-through",
      });
      res.json({ report });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to load admin curation report" });
    }
  });

  app.get("/api/knowledge/project-memory", isAuthenticated, async (req: any, res) => {
    try {
      const { MemoryService } = await import("../services/memoryService");
      res.json({ items: await MemoryService.getProjectMemory(req.user.claims.sub) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch project memory" });
    }
  });

  app.get("/api/knowledge/personal-base", isAuthenticated, async (req: any, res) => {
    try {
      const { MemoryService } = await import("../services/memoryService");
      const items = await MemoryService.getProjectMemory(req.user.claims.sub);
      const item =
        items.find(
          (entry) =>
            (entry.type || "").toLowerCase() === "profile" && entry.isActive !== false,
        ) ||
        items.find((entry) => (entry.type || "").toLowerCase() === "profile") ||
        null;
      res.json({ item });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch personal base memory" });
    }
  });

  app.get("/api/knowledge/voice-memory", isAdmin, async (_req: any, res) => {
    try {
      const { getZedVoiceMemory } = await import("../services/ZedVoiceFormationEngine");
      res.json({ item: await getZedVoiceMemory() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch voice memory" });
    }
  });

  app.put("/api/knowledge/voice-memory", isAdmin, async (req: any, res) => {
    try {
      const { saveZedVoiceMemory } = await import("../services/ZedVoiceFormationEngine");
      const item = await saveZedVoiceMemory(
        req.body || {},
        "Admin-updated ZED canonical voice memory",
      );
      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update voice memory" });
    }
  });

  app.post("/api/knowledge/voice-memory/correction", isAuthenticated, async (req: any, res) => {
    try {
      const { ingestZedVoiceCorrection } = await import("../services/ZedVoiceFormationEngine");
      const item = await ingestZedVoiceCorrection({
        userId: req.user?.claims?.sub || "unknown",
        conversationId: typeof req.body?.conversationId === "string" ? req.body.conversationId : undefined,
        userMessage: String(req.body?.correction || req.body?.content || ""),
        previousAssistantContent:
          typeof req.body?.previousAssistantContent === "string"
            ? req.body.previousAssistantContent
            : undefined,
      });
      res.json({ item, stored: !!item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to store voice correction" });
    }
  });

  app.get("/api/knowledge/core-memory", isAdmin, async (_req: any, res) => {
    try {
      const { MemoryService } = await import("../services/memoryService");
      res.json({ items: await MemoryService.getAllCoreMemory() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch core memory" });
    }
  });

  app.put("/api/knowledge/core-memory/:key", isAdmin, async (req: any, res) => {
    try {
      const { MemoryService } = await import("../services/memoryService");
      const item = await MemoryService.setCoreMemory({
        key: req.params.key,
        value: String(req.body?.value || ""),
        description: req.body?.description || "",
        adminOnly: req.body?.adminOnly ?? true,
      });
      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update core memory" });
    }
  });

  app.post("/api/knowledge/project-memory", isAuthenticated, async (req: any, res) => {
    try {
      await ensureSessionUserInDatabase(req);
      const { MemoryService } = await import("../services/memoryService");
      const item = await MemoryService.createProjectMemory(
        insertProjectMemorySchema.parse({
          userId: req.user.claims.sub,
          name: req.body?.name || "Untitled knowledge item",
          description: req.body?.description || "",
          content: req.body?.content || "",
          type: req.body?.type || "context",
          isActive: req.body?.isActive ?? true,
        }),
      );
      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create project memory" });
    }
  });

  app.put("/api/knowledge/personal-base", isAuthenticated, async (req: any, res) => {
    try {
      await ensureSessionUserInDatabase(req);
      const userId = req.user.claims.sub;
      const { MemoryService } = await import("../services/memoryService");
      const existing = (await MemoryService.getProjectMemory(userId)).find(
        (entry) => (entry.type || "").toLowerCase() === "profile",
      );
      const payload = {
        userId,
        name: req.body?.name || "Personal Base Memory",
        description:
          req.body?.description ||
          "User-owned profile, preferences, goals, and working context.",
        content: req.body?.content || "",
        type: "profile",
        isActive: req.body?.isActive ?? true,
      };
      const item = existing
        ? await MemoryService.updateProjectMemory(existing.id, payload)
        : await MemoryService.createProjectMemory(insertProjectMemorySchema.parse(payload));
      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to save personal base memory" });
    }
  });

  app.patch("/api/knowledge/project-memory/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { MemoryService } = await import("../services/memoryService");
      const owned = (await MemoryService.getProjectMemory(req.user.claims.sub)).find(
        (entry) => entry.id === req.params.id,
      );
      if (!owned) return res.status(404).json({ error: "Project memory not found" });
      const item = await MemoryService.updateProjectMemory(req.params.id, req.body || {});
      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update project memory" });
    }
  });

  app.delete("/api/knowledge/project-memory/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { MemoryService } = await import("../services/memoryService");
      const owned = (await MemoryService.getProjectMemory(req.user.claims.sub)).find(
        (entry) => entry.id === req.params.id,
      );
      if (!owned) return res.status(404).json({ error: "Project memory not found" });
      res.json({ success: await MemoryService.deleteProjectMemory(req.params.id) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete project memory" });
    }
  });

  app.get("/api/knowledge/scratchpad", isAuthenticated, async (req: any, res) => {
    try {
      const { MemoryService } = await import("../services/memoryService");
      res.json({ items: await MemoryService.getScratchpadMemory(req.user.claims.sub) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch scratchpad memory" });
    }
  });

  app.post("/api/knowledge/scratchpad", isAuthenticated, async (req: any, res) => {
    try {
      await ensureSessionUserInDatabase(req);
      const { MemoryService } = await import("../services/memoryService");
      const item = await MemoryService.createScratchpadMemory(
        insertScratchpadMemorySchema.parse({
          userId: req.user.claims.sub,
          conversationId: req.body?.conversationId || null,
          content: req.body?.content || "",
          tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }),
      );
      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create scratchpad memory" });
    }
  });

  app.delete("/api/knowledge/scratchpad/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { MemoryService } = await import("../services/memoryService");
      const owned = (await MemoryService.getScratchpadMemory(req.user.claims.sub)).find(
        (entry) => entry.id === req.params.id,
      );
      if (!owned) return res.status(404).json({ error: "Scratchpad memory not found" });
      res.json({ success: await MemoryService.deleteScratchpadMemory(req.params.id) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete scratchpad memory" });
    }
  });
}
