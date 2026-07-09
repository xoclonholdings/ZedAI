import fs from "fs/promises";
import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { processFile, upload } from "../services/fileProcessor";
import { importTradingKnowledge } from "../zcos/trading/TradingKnowledgeBase";
import { assessStage } from "../zcos/trading/TradingAssessmentEngine";
import { TradingIntegrationsStore } from "../zcos/trading/TradingIntegrationsStore";
import { advanceStage, recordAssessment } from "../services/TradingProgressionStore";
import { TRADING_STAGES, type TradingStageId } from "../../shared/trading-progression";
import {
  INTEGRATION_PROVIDERS,
  integrationProviderInfo,
  type IntegrationProvider,
  type MaterialIngestResult,
} from "../../shared/trading-training-types";

/**
 * Training routes: feed Zed material, test Zed (stage assessment),
 * advance a stage once Zed passes, and manage provider integrations.
 */

function userIdFrom(req: any): string {
  return req.user?.claims?.sub || "unknown";
}

function isStage(id: string): id is TradingStageId {
  return TRADING_STAGES.some((s) => s.id === id);
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

const PROVIDER_IDS = new Set(INTEGRATION_PROVIDERS.map((p) => p.provider));

export function registerTradingTrainingRoutes(app: Express): void {
  /**
   * Feed Zed material for the Learn stage. Accepts either uploaded
   * files (PDF / CSV / DOCX / txt via the shared processor) or a
   * pasted { source, title, text } JSON body. Everything is ingested
   * into Zed's trading knowledge base.
   */
  app.post(
    "/api/trading/knowledge/upload",
    isAuthenticated,
    upload.array("files"),
    async (req: any, res) => {
      try {
        const source = String(req.body?.source || "Uploaded material");
        const sourceType = req.body?.sourceType ? String(req.body.sourceType) : "manual";
        const tags = toArray(req.body?.tags);

        const inputs: Array<{ title: string; text: string }> = [];

        const files = (req.files as Express.Multer.File[] | undefined) || [];
        for (const file of files) {
          const processed = await processFile(file.path, file.mimetype).catch(() => null);
          if (processed?.extractedContent && processed.extractedContent.trim()) {
            inputs.push({ title: file.originalname, text: processed.extractedContent });
          }
          await fs.unlink(file.path).catch(() => {});
        }

        if (typeof req.body?.text === "string" && req.body.text.trim()) {
          inputs.push({
            title: String(req.body?.title || source),
            text: req.body.text,
          });
        }

        if (inputs.length === 0) {
          return res.status(400).json({
            error: "Nothing to ingest. Attach a file or send { source, title, text }.",
          });
        }

        const ingested: MaterialIngestResult[] = [];
        for (const input of inputs) {
          const entry = await importTradingKnowledge({
            source,
            sourceType: sourceType as any,
            title: input.title,
            text: input.text,
            tags,
          });
          ingested.push({
            sourceLabel: input.title,
            entryId: entry.id,
            title: entry.title,
            category: entry.category,
            concepts: entry.concepts.length,
            rules: entry.rules.length,
          });
        }

        res.json({
          ingested,
          totals: {
            sources: ingested.length,
            concepts: ingested.reduce((s, i) => s + i.concepts, 0),
            rules: ingested.reduce((s, i) => s + i.rules, 0),
          },
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Material upload failed" });
      }
    },
  );

  /** Test Zed on a stage. Records the result as the advance gate. */
  app.post("/api/trading/progression/assess/:stageId", isAuthenticated, async (req: any, res) => {
    try {
      const stageId = req.params.stageId;
      if (!isStage(stageId)) return res.status(400).json({ error: "Unknown stage" });
      const result = await assessStage(userIdFrom(req), stageId);
      await recordAssessment(userIdFrom(req), stageId, {
        score: result.score,
        passed: result.passed,
        assessedAt: result.assessedAt,
      });
      res.json({ assessment: result });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Assessment failed" });
    }
  });

  /** Advance out of a stage — blocked until Zed has passed its test. */
  app.post("/api/trading/progression/advance/:stageId", isAuthenticated, async (req: any, res) => {
    try {
      const stageId = req.params.stageId;
      if (!isStage(stageId)) return res.status(400).json({ error: "Unknown stage" });
      const { progression, unlockedStage } = await advanceStage(userIdFrom(req), stageId);
      res.json({ progression, unlockedStage });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Cannot advance yet" });
    }
  });

  app.get("/api/trading/integrations", isAuthenticated, async (req: any, res) => {
    const integrations = await TradingIntegrationsStore.list(userIdFrom(req));
    res.json({ integrations, providers: INTEGRATION_PROVIDERS });
  });

  app.post("/api/trading/integrations/:provider", isAuthenticated, async (req: any, res) => {
    try {
      const provider = String(req.params.provider) as IntegrationProvider;
      if (!PROVIDER_IDS.has(provider)) return res.status(400).json({ error: "Unknown provider" });
      const info = integrationProviderInfo(provider)!;

      const body = req.body || {};
      const fields: Record<string, string> = {};
      const secrets: Record<string, string> = {};
      for (const field of info.fields) {
        const value = body[field.key];
        if (typeof value !== "string") continue;
        if (field.secret) secrets[field.key] = value;
        else fields[field.key] = value;
      }

      const integration = await TradingIntegrationsStore.connect({
        userId: userIdFrom(req),
        provider,
        label: typeof body.label === "string" ? body.label : undefined,
        baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : fields.baseUrl,
        fields,
        secrets,
        notes: typeof body.notes === "string" ? body.notes : undefined,
      });
      res.json({ integration });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to connect" });
    }
  });

  app.post("/api/trading/integrations/:provider/test", isAuthenticated, async (req: any, res) => {
    try {
      const provider = String(req.params.provider) as IntegrationProvider;
      if (!PROVIDER_IDS.has(provider)) return res.status(400).json({ error: "Unknown provider" });
      const integration = await TradingIntegrationsStore.test(userIdFrom(req), provider);
      res.json({ integration });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Test failed" });
    }
  });

  app.delete("/api/trading/integrations/:provider", isAuthenticated, async (req: any, res) => {
    try {
      const provider = String(req.params.provider) as IntegrationProvider;
      if (!PROVIDER_IDS.has(provider)) return res.status(400).json({ error: "Unknown provider" });
      await TradingIntegrationsStore.disconnect(userIdFrom(req), provider);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to disconnect" });
    }
  });
}
