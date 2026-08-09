import type { Express, Request } from "express";

import { generateChatFromProvider } from "../services/ModelProviderService";
import { webSearch } from "../services/WebSearchService";
import { addToCollection, queryCollection } from "../services/ChromaService";
import { AgentApprovalAdapter } from "../services/approval/AgentApprovalAdapter";
import { authenticateZillionCapability } from "../services/capital/ZillionCapabilityAuth";

function ownerFrom(req: Request): string {
  return String((req as any).capitalOwnerUserId || "");
}

function requireCapability(req: Request, expected: string): void {
  if (req.body?.capability !== expected) {
    throw new Error(`Expected capability ${expected}.`);
  }
}

export function registerCapabilityRoutes(app: Express): void {
  app.post("/api/capabilities/model/chat", authenticateZillionCapability, async (req, res) => {
    try {
      requireCapability(req, "zillion.capital.analysis");
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const systemPrompt = String(req.body?.systemPrompt || "");
      if (messages.length === 0 || systemPrompt.length > 40_000) {
        return res.status(400).json({ error: "Invalid Capital model request." });
      }
      const message = await generateChatFromProvider(messages, systemPrompt, {
        lane: "finance",
        attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : undefined,
        reasoningEffort: req.body?.reasoningEffort,
      });
      res.json({ message });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Model capability failed." });
    }
  });

  app.post("/api/capabilities/web/search", authenticateZillionCapability, async (req, res) => {
    try {
      requireCapability(req, "zillion.capital.research");
      const query = String(req.body?.query || "").trim();
      if (!query || query.length > 2_000) return res.status(400).json({ error: "Invalid search query." });
      res.json(await webSearch(query, Math.min(10, Math.max(1, Number(req.body?.limit) || 4))));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Search capability failed." });
    }
  });

  app.post("/api/capabilities/knowledge/search", authenticateZillionCapability, async (req, res) => {
    try {
      requireCapability(req, "zillion.capital.knowledge.read");
      const query = String(req.body?.query || "").trim();
      if (!query) return res.status(400).json({ error: "Knowledge query is required." });
      const limit = Math.min(10, Math.max(1, Number(req.body?.limit) || 3));
      const records = await queryCollection("semantic", query, limit * 4);
      const owned = records
        .filter((record) =>
          record.metadata?.originGalaxy === "ZILLION" &&
          record.metadata?.ownerUserId === ownerFrom(req),
        )
        .slice(0, limit);
      res.json({ context: owned.map((record) => record.document).join("\n\n") });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Knowledge capability failed." });
    }
  });

  app.post("/api/capabilities/knowledge/contribute", authenticateZillionCapability, async (req, res) => {
    try {
      requireCapability(req, "zillion.capital.knowledge.contribute");
      const brief = req.body?.brief || {};
      const topic = String(brief.topic || "ZILLION Capital research").slice(0, 500);
      const findings = Array.isArray(brief.keyFindings)
        ? brief.keyFindings.map(String).slice(0, 20)
        : [];
      if (findings.length === 0) {
        return res.status(400).json({ error: "At least one finding is required." });
      }
      await addToCollection("semantic", {
        id: `zillion-capital-${Date.now()}-${String((req as any).capitalMessageId || "receipt")}`,
        document: [
          `Topic: ${topic}`,
          "Findings:",
          ...findings.map((finding) => `- ${finding.slice(0, 2_000)}`),
          `Implications: ${String(brief.implications || "").slice(0, 4_000)}`,
          `Recommended action: ${String(brief.recommendedAction || "").slice(0, 4_000)}`,
        ].join("\n"),
        metadata: {
          originGalaxy: "ZILLION",
          ownerUserId: ownerFrom(req),
          topic,
          date: String(brief.date || new Date().toISOString()).slice(0, 80),
          confidence: String(brief.confidence || "low").slice(0, 80),
        },
      });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Knowledge contribution failed." });
    }
  });

  app.post("/api/capabilities/approvals", authenticateZillionCapability, async (req, res) => {
    try {
      requireCapability(req, "zillion.capital.approval.request");
      const result = await AgentApprovalAdapter.register({
        user_id: ownerFrom(req),
        conversation_id: req.body?.conversation_id ? String(req.body.conversation_id) : null,
        message: String(req.body?.message || ""),
        draft: String(req.body?.draft || ""),
        agent: "FinanceAgent",
        capabilities: Array.isArray(req.body?.capabilities) ? req.body.capabilities.map(String) : [],
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Approval capability failed." });
    }
  });
}
