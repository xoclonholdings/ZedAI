import path from "path";
import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { upload } from "../services/fileProcessor";
import { db } from "../db";
import { users } from "../../shared/schema";
import {
  getUserPersonalization,
  saveUserPersonalization,
} from "../services/UserPersonalizationStore";
import {
  deletePersonalizationNote,
  listPersonalizationNotes,
  readPersonalizationNote,
  savePersonalizationNote,
} from "../services/UserPersonalizationCorpus";
import { logRuntimeEvent } from "../services/RuntimeLogger";

/**
 * Session-scoped "current user" surfaces: identity payload, the
 * per-user personalization (font size, compact messages, display
 * name, etc.), and the avatar upload pipeline.
 */
export function registerMeRoutes(app: Express): void {
  app.get("/api/me", (req, res) => {
    const session = (req as any).session;
    if (session?.userId && session?.user) {
      void getUserPersonalization(session.userId)
        .then((personalization) => {
          res.json({
            user: {
              ...session.user,
              displayName: personalization.displayName,
              personalization,
            },
          });
        })
        .catch(() => {
          res.json({ user: session.user });
        });
      return;
    }
    return res.json({ user: null });
  });

  app.get("/api/settings/personalization", isAuthenticated, async (req: any, res) => {
    try {
      const personalization = await getUserPersonalization(req.user.claims.sub);
      res.json(personalization);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch personalization" });
    }
  });

  app.put("/api/settings/personalization", isAuthenticated, async (req: any, res) => {
    try {
      const personalization = await saveUserPersonalization(
        req.user.claims.sub,
        req.body || {},
      );
      res.json(personalization);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update personalization" });
    }
  });

  // ── Personal memory corpus ───────────────────────────────────────
  // Per-user notes about themselves that get keyword-ranked into
  // the Cognitive Core knowledge slot at query time. Storage:
  // hub/user-personalization/<userId>/notes/<slug>.md
  app.get("/api/me/personalization/notes", isAuthenticated, async (req: any, res) => {
    try {
      res.json({ notes: await listPersonalizationNotes(req.user.claims.sub) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to list personal notes" });
    }
  });

  app.get(
    "/api/me/personalization/notes/:slug",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const note = await readPersonalizationNote(req.user.claims.sub, req.params.slug);
        if (!note) return res.status(404).json({ error: "Note not found" });
        res.json(note);
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Failed to read note" });
      }
    },
  );

  app.post("/api/me/personalization/notes", isAuthenticated, async (req: any, res) => {
    try {
      const { title, content, slug } = req.body || {};
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "title is required" });
      }
      if (typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "content is required" });
      }
      const note = await savePersonalizationNote({
        userId: req.user.claims.sub,
        slug: typeof slug === "string" && slug ? slug : undefined,
        title: title.trim(),
        content,
      });
      res.json(note);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to save note" });
    }
  });

  app.delete(
    "/api/me/personalization/notes/:slug",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const ok = await deletePersonalizationNote(req.user.claims.sub, req.params.slug);
        if (!ok) return res.status(404).json({ error: "Note not found" });
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Failed to delete note" });
      }
    },
  );

  app.post(
    "/api/me/avatar",
    isAuthenticated,
    upload.single("photo"),
    async (req: any, res) => {
      try {
        const file = req.file as Express.Multer.File | undefined;
        if (!file) return res.status(400).json({ error: "No photo uploaded" });
        if (!file.mimetype?.startsWith("image/")) {
          return res.status(400).json({ error: "Photo must be an image" });
        }
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const publicUrl = `/uploads/${path.basename(file.path)}`;

        try {
          if (db) {
            await db
              .insert(users)
              .values({ id: userId, profileImageUrl: publicUrl })
              .onConflictDoUpdate({
                target: users.id,
                set: { profileImageUrl: publicUrl, updatedAt: new Date() },
              });
          }
        } catch (dbErr: any) {
          void logRuntimeEvent({
            level: "warn",
            source: "server",
            event: "avatar.db_update_failed",
            detail: dbErr?.message || String(dbErr),
            context: { userId },
          });
        }

        if (req.session?.user) {
          req.session.user.profileImageUrl = publicUrl;
        }

        res.json({ profileImageUrl: publicUrl });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Avatar upload failed" });
      }
    },
  );
}
