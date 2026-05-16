import path from "path";
import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { upload } from "../services/fileProcessor";
import {
  addProjectSource,
  assignConversationToProject,
  createProject,
  getProject,
  listProjects,
  removeProjectSource,
  updateProjectInstructions,
} from "../services/ProjectFilingStore";

/**
 * Registers all /api/projects/* endpoints, plus the conversation→project
 * assignment endpoint that thematically belongs here. Each handler is
 * thin — heavy lifting lives in ProjectFilingStore.
 */
export function registerProjectRoutes(app: Express): void {
  app.get("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const projects = await listProjects(req.user.claims.sub);
      res.json({ projects });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const project = await createProject(req.user.claims.sub, req.body?.name || "");
      res.json({ project });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create project" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const project = await getProject(req.user.claims.sub, req.params.id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to load project" });
    }
  });

  // Per-project system instructions — injected into the agent context for
  // any conversation filed under this project.
  app.put("/api/projects/:id/instructions", isAuthenticated, async (req: any, res) => {
    try {
      const project = await updateProjectInstructions(
        req.user.claims.sub,
        req.params.id,
        String(req.body?.instructions || ""),
      );
      res.json({ project });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update instructions" });
    }
  });

  // Add a source: multipart file=<File>, OR JSON { label, url, text, notes }.
  app.post(
    "/api/projects/:id/sources",
    isAuthenticated,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const projectId = req.params.id;
        const file = req.file as Express.Multer.File | undefined;
        const label =
          (req.body?.label && String(req.body.label).trim()) ||
          (file?.originalname ? path.basename(file.originalname) : "Source");
        const url = file
          ? `/uploads/${path.basename(file.path)}`
          : req.body?.url
            ? String(req.body.url)
            : undefined;
        const text = req.body?.text ? String(req.body.text) : undefined;
        const notes = req.body?.notes ? String(req.body.notes) : undefined;
        const source = await addProjectSource(userId, projectId, {
          label,
          url,
          text,
          notes,
        });
        res.json({ source });
      } catch (error: any) {
        res.status(400).json({ error: error.message || "Failed to add source" });
      }
    },
  );

  app.delete(
    "/api/projects/:id/sources/:sourceId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const project = await removeProjectSource(
          req.user.claims.sub,
          req.params.id,
          req.params.sourceId,
        );
        res.json({ project });
      } catch (error: any) {
        res.status(400).json({ error: error.message || "Failed to remove source" });
      }
    },
  );

  // Convo → project assignment — kept here because it edits the project's
  // conversationIds array (ProjectFilingStore owns the state).
  app.put("/api/conversations/:id/project", isAuthenticated, async (req: any, res) => {
    try {
      const projects = await assignConversationToProject(
        req.user.claims.sub,
        req.params.id,
        req.body?.projectId ?? null,
      );
      res.json({ projects });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || "Failed to assign conversation to project",
      });
    }
  });
}
