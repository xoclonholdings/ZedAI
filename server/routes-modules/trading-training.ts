import fs from "fs/promises";
import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { processFile, upload } from "../services/fileProcessor";
import { importTradingKnowledge } from "../zcos/trading/TradingKnowledgeBase";
import { tradingDbAvailable } from "../zcos/trading/tradingPersistence";
import {
  assessKnowledgeArea,
  assessStage,
  listKnowledgeAreas,
} from "../zcos/trading/TradingAssessmentEngine";
import { TRADING_KNOWLEDGE_AREAS } from "../zcos/trading/TradingCurriculum";
import { TradingIntegrationsStore } from "../zcos/trading/TradingIntegrationsStore";
import { testWebullConnection } from "../zcos/trading/WebullBridge";
import { advanceStage, recordAssessment } from "../services/TradingProgressionStore";
import { TRADING_STAGES, type TradingStageId } from "../../shared/trading-progression";
import {
  INTEGRATION_PROVIDERS,
  integrationProviderInfo,
  type IntegrationProvider,
  type MaterialIngestResult,
} from "../../shared/trading-training-types";
import { userIdFrom } from "./trading-route-helpers";

/**
 * Training routes: feed ZAR material, test ZAR (stage assessment),
 * advance a stage once ZAR passes, and manage provider integrations.
 */

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
   * Feed ZAR material for the Learn stage. Accepts either uploaded
   * files (PDF / CSV / DOCX / txt via the shared processor) or a
   * pasted { source, title, text } JSON body. Everything is ingested
   * into ZAR's trading knowledge base.
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

        // Bind this material to a specific Learn-stage section when the
        // upload came from one, so per-section coverage/testing is exact.
        const areaId = req.body?.area ? String(req.body.area) : "";
        const area = TRADING_KNOWLEDGE_AREAS.find((a) => a.id === areaId);
        if (area) {
          for (const tag of [area.id, area.title]) {
            if (!tags.includes(tag)) tags.push(tag);
          }
        }

        const inputs: Array<{ title: string; text: string }> = [];
        const failures: Array<{ fileName: string; error: string }> = [];

        const files = (req.files as Express.Multer.File[] | undefined) || [];
        for (const file of files) {
          const processed = await processFile(file.path, file.mimetype, file.originalname).catch((error) => ({
            extractedContent: "",
            error: error?.message || "File processing failed.",
          } as any));
          if (processed?.error || !processed?.extractedContent?.trim()) {
            failures.push({
              fileName: file.originalname,
              error: processed?.error || "No extractable content was found.",
            });
          } else {
            inputs.push({ title: file.originalname, text: processed.extractedContent });
          }
          await fs.unlink(file.path).catch(() => {});
        }

        if (failures.length > 0) {
          return res.status(422).json({
            error: failures.map((failure) => `${failure.fileName}: ${failure.error}`).join(" "),
            failures,
          });
        }

        if (typeof req.body?.text === "string" && req.body.text.trim()) {
          inputs.push({
            title: String(req.body?.title || source),
            text: req.body.text,
          });
        }

        if (inputs.length === 0) {
          return res.status(400).json({
            error: "Nothing to add. Attach a file or send { source, title, text }.",
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

  /**
   * The Learn-stage sections (one per required knowledge area) with
   * per-section coverage and how much material ZAR has for each.
   */
  app.get("/api/trading/knowledge/areas", isAuthenticated, async (_req: any, res) => {
    try {
      const areas = await listKnowledgeAreas();
      res.json({ areas });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load sections" });
    }
  });

  /** Test ZAR on ONE knowledge section (upload → test that section). */
  app.post("/api/trading/knowledge/areas/:areaId/assess", isAuthenticated, async (req: any, res) => {
    try {
      const assessment = await assessKnowledgeArea(String(req.params.areaId));
      res.json({ assessment });
    } catch (err: any) {
      const status = /unknown knowledge section/i.test(err?.message || "") ? 400 : 500;
      res.status(status).json({ error: err?.message || "Section test failed" });
    }
  });

  /** Test ZAR on a stage. Records the result as the advance gate. */
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

  /** Advance out of a stage — blocked until ZAR has passed its test. */
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
    // durable=false means no database is reachable, so connections would
    // only live in throwaway files — the UI warns the user instead of
    // letting them vanish silently on the next restart.
    res.json({ integrations, providers: INTEGRATION_PROVIDERS, durable: tradingDbAvailable() });
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

      // Webull has a real live bridge — the generic test below only checks
      // that required fields are non-empty, which can't distinguish a
      // working credential pair from a wrong/expired one. Route it through
      // the same live account-list call the Webull-specific UI uses, so
      // "Test" here means the same thing everywhere it's clicked.
      if (provider === "webull") {
        const userId = userIdFrom(req);
        const result = await testWebullConnection(userId);
        const integration = await TradingIntegrationsStore.recordTestResult(userId, provider, {
          status: result.ok ? "connected" : "error",
          result: result.message,
        });
        if (!result.ok) return res.status(502).json({ error: result.message, integration });
        return res.json({ integration });
      }

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
