import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { cleanupFile, processFile, upload } from "../services/fileProcessor";
import { LearningStudioService } from "../services/learning/LearningStudioService";
import { ensureSessionUserInDatabase } from "./conversations-crud";
import type { LearningBlueprint } from "../../shared/learning-types";

function userIdFrom(req: any): string {
  return req.user?.claims?.sub || req.session?.userId || "user_001";
}

function bodyString(body: any, key: string): string | undefined {
  const value = body?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseAnswers(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseBlueprint(value: unknown): LearningBlueprint | undefined {
  if (!value) return undefined;
  if (typeof value === "object") return value as LearningBlueprint;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as LearningBlueprint;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function registerLearningRoutes(app: Express): void {
  app.get("/api/learning/paths", isAuthenticated, async (req: any, res) => {
    try {
      res.json({ paths: await LearningStudioService.listPaths(userIdFrom(req)) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load learning paths" });
    }
  });

  app.post(
    "/api/learning/paths/blueprint",
    isAuthenticated,
    upload.array("files"),
    async (req: any, res) => {
      const files = (req.files as Express.Multer.File[] | undefined) || [];
      try {
        await ensureSessionUserInDatabase(req);
        const sources = [];
        for (const file of files) {
          const processed = await processFile(file.path, file.mimetype).catch((error) => ({
            extractedContent: "",
            error: error?.message || "processing failed",
          } as any));
          sources.push({
            kind: "file" as const,
            label: file.originalname,
            content:
              processed?.extractedContent && String(processed.extractedContent).trim()
                ? String(processed.extractedContent)
                : `Attached file ${file.originalname}; no extractable text was produced.`,
            metadata: {
              mimeType: file.mimetype,
              size: file.size,
              processingError: processed?.error,
            },
          });
          await cleanupFile(file.path);
        }

        const detail = await LearningStudioService.createBlueprint({
          userId: userIdFrom(req),
          topic: bodyString(req.body, "topic") || "",
          assumedLevel: bodyString(req.body, "assumedLevel"),
          workspaceId: bodyString(req.body, "workspaceId"),
          projectId: bodyString(req.body, "projectId"),
          notes: bodyString(req.body, "notes"),
          sources,
        });
        res.json(detail);
      } catch (error: any) {
        await Promise.allSettled(files.map((file) => cleanupFile(file.path)));
        res.status(400).json({ error: error?.message || "Failed to create learning blueprint" });
      }
    },
  );

  app.get("/api/learning/paths/:id", isAuthenticated, async (req: any, res) => {
    try {
      const detail = await LearningStudioService.getPath(userIdFrom(req), req.params.id);
      if (!detail) return res.status(404).json({ error: "Learning path not found" });
      res.json(detail);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load learning path" });
    }
  });

  app.post("/api/learning/paths/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      await ensureSessionUserInDatabase(req);
      const detail = await LearningStudioService.approveBlueprint(
        userIdFrom(req),
        req.params.id,
        parseBlueprint(req.body?.blueprint),
      );
      res.json(detail);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to approve blueprint" });
    }
  });

  app.post(
    "/api/learning/paths/:pathId/lessons/:lessonId/attempts",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const result = await LearningStudioService.submitAssessment(
          userIdFrom(req),
          req.params.pathId,
          req.params.lessonId,
          parseAnswers(req.body?.answers),
        );
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ error: error?.message || "Failed to submit assessment" });
      }
    },
  );
}

export default registerLearningRoutes;
