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
  app.post(
    "/api/me/memory/merge-objects",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub || "user";
        const keepId = typeof req.body?.keepId === "string" ? req.body.keepId : "";
        const dropIds: string[] = Array.isArray(req.body?.dropIds)
          ? req.body.dropIds.filter((s: unknown): s is string => typeof s === "string")
          : [];
        if (!keepId || dropIds.length === 0) {
          return res.status(400).json({
            error: "Provide keepId and a non-empty dropIds array.",
          });
        }
        const graph = await readAppliedGraph();
        if (!graph) {
          return res.status(400).json({ error: "No applied graph to merge into." });
        }
        const keeper = graph.objects.find((o) => o.id === keepId);
        if (!keeper) {
          return res.status(404).json({ error: "keepId not found in graph." });
        }
        const dropSet = new Set(dropIds.filter((id) => id !== keepId));
        const dropped = graph.objects.filter((o) => dropSet.has(o.id));
        if (dropped.length === 0) {
          return res.status(400).json({ error: "No dropIds matched objects in graph." });
        }

        const mergedAliases = new Set(keeper.aliases || []);
        const mergedSourceRefs = [...(keeper.sourceRefs || [])];
        for (const d of dropped) {
          if (d.canonicalName && d.canonicalName !== keeper.canonicalName) {
            mergedAliases.add(d.canonicalName);
          }
          for (const alias of d.aliases || []) mergedAliases.add(alias);
          for (const ref of d.sourceRefs || []) mergedSourceRefs.push(ref);
        }

        const nextObjects = graph.objects
          .filter((o) => !dropSet.has(o.id))
          .map((o) =>
            o.id === keeper.id
              ? {
                  ...o,
                  aliases: Array.from(mergedAliases),
                  sourceRefs: mergedSourceRefs,
                  updatedAt: new Date().toISOString(),
                }
              : o,
          );

        const nextRelationships = graph.relationships
          .map((rel) => ({
            ...rel,
            fromObjectId: dropSet.has(rel.fromObjectId) ? keeper.id : rel.fromObjectId,
            toObjectId: dropSet.has(rel.toObjectId) ? keeper.id : rel.toObjectId,
          }))
          .filter(
            (rel, i, arr) =>
              rel.fromObjectId !== rel.toObjectId &&
              arr.findIndex(
                (other) =>
                  other.fromObjectId === rel.fromObjectId &&
                  other.toObjectId === rel.toObjectId &&
                  other.relationshipType === rel.relationshipType,
              ) === i,
          );

        const nextGraph: ObjectGraph = {
          ...graph,
          generatedAt: new Date().toISOString(),
          objects: nextObjects,
          relationships: nextRelationships,
          stats: graphStats(nextObjects, nextRelationships),
        };
        const applied = await writeAppliedGraph(nextGraph);

        void logRuntimeEvent({
          level: "info",
          source: "server",
          event: "memory.merge",
          detail: `Merged ${dropped.length} duplicate object(s) into ${keeper.canonicalName}`,
          context: {
            userId,
            keepId,
            dropIds: Array.from(dropSet),
            backup: applied.backupPath ? path.basename(applied.backupPath) : null,
          },
        });

        res.json({
          merged: dropped.length,
          keeper: {
            id: keeper.id,
            canonicalName: keeper.canonicalName,
            aliases: Array.from(mergedAliases),
          },
          totals: {
            graphObjects: nextGraph.objects.length,
            graphRelationships: nextGraph.relationships.length,
          },
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Merge failed" });
      }
    },
  );

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

        // Optional workspace tag. Uploaded knowledge still merges into
        // Zed's single core memory graph, but each object is stamped with
        // the workspace it came from so a workspace can show its own
        // library (a slice of core memory) without forking storage.
        const workspace =
          typeof req.body?.workspace === "string" ? req.body.workspace.trim() : "";

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
          if (workspace) {
            for (const o of objects) {
              (o.properties as Record<string, unknown>).workspace = workspace;
            }
          }
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
