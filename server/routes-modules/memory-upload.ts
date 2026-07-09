import fs from "fs/promises";
import path from "path";
import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { processFile, upload } from "../services/fileProcessor";
import { extractObjectsFromSource } from "../services/object-memory/extractor";
import {
  graphStats,
  readAppliedGraph,
  writeAppliedGraph,
} from "../services/object-memory/store";
import type { ObjectGraph } from "../../shared/object-memory-types";
import { logRuntimeEvent } from "../services/RuntimeLogger";

/**
 * User-facing memory upload — a single endpoint that takes what a
 * user wants Zed to remember (a pasted note OR an uploaded file),
 * runs it through the same object-memory extractor the CLI uses,
 * and merges the result into the applied graph.
 *
 * That graph is already consulted by KnowledgeService on every chat
 * request via retrieveObjectMemoryForQuery, so anything the user
 * uploads here becomes something Zed can pull into any conversation
 * within seconds — no restart, no promotion step.
 *
 * Two shapes accepted on POST /api/me/memory/upload:
 *
 *   1) JSON body:
 *      { "title": "About my company",
 *        "content": "ZebCom is my parent company..." }
 *
 *   2) Multipart form:
 *      files=@notes.pdf, files=@transcript.txt
 *      (uses the existing multer + processFile pipeline that
 *       chat uploads use, so the same file types are supported)
 *
 * Response returns the extracted objects and updated graph stats
 * so the caller can show the user exactly what Zed learned.
 */

interface UploadResult {
  sourceLabel: string;
  extractedObjects: number;
  extractedRelationships: number;
  objectTitles: string[];
}

export function registerMemoryUploadRoutes(app: Express): void {
  app.get("/api/me/memory/graph", isAuthenticated, async (_req: any, res) => {
    try {
      const graph = await readAppliedGraph();
      if (!graph) {
        return res.json({
          version: "1",
          generatedAt: null,
          sources: [],
          objects: [],
          relationships: [],
          stats: { objectCount: 0, relationshipCount: 0 },
        });
      }
      res.json(graph);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to read memory graph" });
    }
  });

  app.post(
    "/api/me/memory/upload",
    isAuthenticated,
    upload.array("files"),
    async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub || "user";
        const now = new Date().toISOString();

        const inputs: Array<{ sourceFile: string; text: string; title?: string }> = [];

        // Path A: multipart files. Each file is processed for text
        // extraction (PDF/CSV/text/DOCX/etc via existing fileProcessor).
        const files = (req.files as Express.Multer.File[] | undefined) || [];
        for (const file of files) {
          const processed = await processFile(file.path, file.mimetype).catch((err) => ({
            extractedContent: "",
            error: err?.message || "processing failed",
          } as any));
          if (processed?.extractedContent && processed.extractedContent.trim()) {
            inputs.push({
              sourceFile: `upload/${file.originalname}`,
              text: processed.extractedContent,
              title: file.originalname,
            });
          }
          await fs.unlink(file.path).catch(() => {});
        }

        // Path B: JSON body {title, content}. Coexists with file
        // upload so a caller can send both.
        if (typeof req.body?.content === "string" && req.body.content.trim()) {
          const title =
            typeof req.body?.title === "string" && req.body.title.trim()
              ? req.body.title.trim()
              : `user-upload-${Date.now()}`;
          inputs.push({
            sourceFile: `upload/text/${title}`,
            text: req.body.content,
            title,
          });
        }

        if (inputs.length === 0) {
          return res.status(400).json({
            error:
              "Nothing to upload. Send { title, content } as JSON or attach files.",
          });
        }

        const perSource: UploadResult[] = [];
        let objectsAll: any[] = [];
        let relationshipsAll: any[] = [];
        for (const input of inputs) {
          const { objects, relationships } = extractObjectsFromSource({
            sourceFile: input.sourceFile,
            conversationTitle: input.title,
            text: input.text,
          });
          objectsAll = objectsAll.concat(objects);
          relationshipsAll = relationshipsAll.concat(relationships);
          perSource.push({
            sourceLabel: input.title || input.sourceFile,
            extractedObjects: objects.length,
            extractedRelationships: relationships.length,
            objectTitles: objects.slice(0, 12).map((o) => `${o.type}:${o.canonicalName}`),
          });
        }

        // Merge into the applied graph. If none exists yet, this
        // creates it. If one does, we append and rewrite (the store
        // backs up the prior graph automatically).
        const prior = await readAppliedGraph();
        const mergedObjects = [...(prior?.objects || []), ...objectsAll];
        const mergedRelationships = [...(prior?.relationships || []), ...relationshipsAll];
        const merged: ObjectGraph = {
          version: prior?.version || "1",
          generatedAt: now,
          sources: Array.from(
            new Set([...(prior?.sources || []), ...inputs.map((i) => i.sourceFile)]),
          ),
          objects: mergedObjects,
          relationships: mergedRelationships,
          stats: graphStats(mergedObjects, mergedRelationships),
        };
        const applied = await writeAppliedGraph(merged);

        void logRuntimeEvent({
          level: "info",
          source: "server",
          event: "memory.upload",
          detail: `${objectsAll.length} objects / ${relationshipsAll.length} relationships from ${inputs.length} source(s)`,
          context: { userId, backup: applied.backupPath ? path.basename(applied.backupPath) : null },
        });

        res.json({
          uploaded: perSource,
          totals: {
            newObjects: objectsAll.length,
            newRelationships: relationshipsAll.length,
            graphObjects: merged.objects.length,
            graphRelationships: merged.relationships.length,
          },
          appliedAt: now,
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Memory upload failed" });
      }
    },
  );
}
