import type { Express, Request, Response } from "express";

import { isAdmin, isAuthenticated } from "../localAuth";
import { LexiconAuthorityService } from "../services/lexicon-authority/LexiconAuthorityService";
import type { LexiconResolutionContext } from "../services/lexicon-authority/types";

const INVALID_MEMORY_USER_IDS = new Set(["user", "user_001", "default-user", "anonymous", "admin-user", "unknown"]);

function requireRequestUserId(req: any): string {
  const userId = String(req?.user?.claims?.sub || req?.session?.userId || "").trim();
  if (!userId || INVALID_MEMORY_USER_IDS.has(userId)) {
    throw new Error("Lexicon operation requires an authenticated user owner");
  }
  return userId;
}

function contextFromQuery(req: Request): LexiconResolutionContext {
  return {
    domain: typeof req.query.domain === "string" ? req.query.domain : undefined,
    community: typeof req.query.community === "string" ? req.query.community : undefined,
    conversationText: typeof req.query.conversationText === "string" ? req.query.conversationText : undefined,
  };
}

/**
 * Lexicon Authority — the Knowledge Authority's semantic interpretation
 * layer. See SPEC.md § Lexicon Authority for the reasoning-pipeline
 * wiring and server/services/lexicon-authority/ for the service.
 */
export function registerLexiconRoutes(app: Express): void {
  app.get("/api/lexicon/resolve", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const term = String(req.query.term || "").trim();
      if (!term) return res.status(400).json({ error: "term is required" });
      res.json({ resolution: await LexiconAuthorityService.resolveTerm(term, contextFromQuery(req)) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Term resolution failed" });
    }
  });

  app.get("/api/lexicon/resolve-phrase", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const phrase = String(req.query.phrase || "").trim();
      if (!phrase) return res.status(400).json({ error: "phrase is required" });
      res.json({ resolution: await LexiconAuthorityService.resolvePhrase(phrase, contextFromQuery(req)) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Phrase resolution failed" });
    }
  });

  app.post("/api/lexicon/resolve-meaning", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const entryIds = Array.isArray(req.body?.entryIds) ? req.body.entryIds.map(String) : [];
      if (!entryIds.length) return res.status(400).json({ error: "entryIds is required" });
      const context: LexiconResolutionContext = {
        domain: typeof req.body?.domain === "string" ? req.body.domain : undefined,
        community: typeof req.body?.community === "string" ? req.body.community : undefined,
        conversationText: typeof req.body?.conversationText === "string" ? req.body.conversationText : undefined,
      };
      res.json(await LexiconAuthorityService.resolveMeaning(entryIds, context));
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Meaning resolution failed" });
    }
  });

  app.post("/api/lexicon/resolve-text", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const text = String(req.body?.text || "").trim();
      if (!text) return res.status(400).json({ error: "text is required" });
      const context: LexiconResolutionContext = {
        domain: typeof req.body?.domain === "string" ? req.body.domain : undefined,
        community: typeof req.body?.community === "string" ? req.body.community : undefined,
      };
      res.json(await LexiconAuthorityService.resolveText(text, context));
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Text resolution failed" });
    }
  });

  app.get("/api/lexicon/suggest", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const term = String(req.query.term || "").trim();
      if (!term) return res.status(400).json({ error: "term is required" });
      res.json({ suggestion: await LexiconAuthorityService.suggestMeaning(term, contextFromQuery(req)) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Meaning suggestion failed" });
    }
  });

  app.get("/api/lexicon/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const query = String(req.query.q || "");
      const includeCandidates = req.query.includeCandidates !== "false";
      res.json({ entries: await LexiconAuthorityService.searchLexicon(query, { includeCandidates }) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Lexicon search failed" });
    }
  });

  app.get("/api/lexicon/domains", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      res.json({ domains: await LexiconAuthorityService.listDomains() });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to list domains" });
    }
  });

  app.get("/api/lexicon/domains/:domainId/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      res.json({ entries: await LexiconAuthorityService.searchDomain(String(req.params.domainId), String(req.query.q || "")) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Domain search failed" });
    }
  });

  app.get("/api/lexicon/communities/:communityId/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      res.json({ entries: await LexiconAuthorityService.searchCommunity(String(req.params.communityId), String(req.query.q || "")) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Community search failed" });
    }
  });

  app.get("/api/lexicon/user-vocabulary", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = requireRequestUserId(req);
      res.json({ entries: await LexiconAuthorityService.searchUserVocabulary(userId, String(req.query.q || "")) });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "User vocabulary search failed" });
    }
  });

  app.get("/api/lexicon/authorities", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      res.json({ authorities: LexiconAuthorityService.listAuthorities() });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to list authorities" });
    }
  });

  app.get("/api/lexicon/related", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const target = String(req.query.term || req.query.entryId || "").trim();
      if (!target) return res.status(400).json({ error: "term or entryId is required" });
      res.json({ related: await LexiconAuthorityService.findRelatedTerms(target, contextFromQuery(req)) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Related-term lookup failed" });
    }
  });

  app.post("/api/lexicon/candidates", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = requireRequestUserId(req);
      const isAdminUser = !!req.user?.claims?.isAdmin;
      const entry = await LexiconAuthorityService.registerCandidate({
        term: String(req.body?.term || ""),
        definitionGuess: typeof req.body?.definitionGuess === "string" ? req.body.definitionGuess : undefined,
        domain: typeof req.body?.domain === "string" ? req.body.domain : undefined,
        community: typeof req.body?.community === "string" ? req.body.community : undefined,
        evidenceExcerpt: String(req.body?.evidenceExcerpt || ""),
        sourceLabel: String(req.body?.sourceLabel || "conversation"),
        userId,
        conversationId: typeof req.body?.conversationId === "string" ? req.body.conversationId : undefined,
        // Only an admin curating shared terminology may register directly
        // into the shared/global lexicon; everyone else's candidates stay
        // scoped to their own personal vocabulary until an admin confirms
        // or merges them in.
        ownerScope: isAdminUser && req.body?.ownerScope === "global" ? "global" : "user",
      });
      res.json({ entry });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Candidate registration failed" });
    }
  });

  app.get("/api/lexicon/candidates", isAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 25;
      res.json({ entries: await LexiconAuthorityService.listCandidates(limit) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to list candidates" });
    }
  });

  app.get("/api/lexicon/overview", isAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ overview: await LexiconAuthorityService.getOverview() });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to load lexicon overview" });
    }
  });

  app.post("/api/lexicon/entries/:id/confirm", isAdmin, async (req: any, res: Response) => {
    try {
      const reviewer = requireRequestUserId(req);
      const entry = await LexiconAuthorityService.confirmMeaning(
        req.params.id,
        reviewer,
        typeof req.body?.definition === "string" ? req.body.definition : undefined,
      );
      res.json({ entry });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Confirming meaning failed" });
    }
  });

  app.post("/api/lexicon/entries/:id/reject", isAdmin, async (req: any, res: Response) => {
    try {
      const reviewer = requireRequestUserId(req);
      const entry = await LexiconAuthorityService.rejectMeaning(
        req.params.id,
        reviewer,
        typeof req.body?.reason === "string" ? req.body.reason : undefined,
      );
      res.json({ entry });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Rejecting meaning failed" });
    }
  });

  app.post("/api/lexicon/entries/:id/deprecate", isAdmin, async (req: any, res: Response) => {
    try {
      const reviewer = requireRequestUserId(req);
      const entry = await LexiconAuthorityService.deprecateEntry(
        req.params.id,
        reviewer,
        typeof req.body?.reason === "string" ? req.body.reason : undefined,
        typeof req.body?.supersededBy === "string" ? req.body.supersededBy : undefined,
      );
      res.json({ entry });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Deprecating entry failed" });
    }
  });

  app.post("/api/lexicon/entries/merge", isAdmin, async (req: any, res: Response) => {
    try {
      const reviewer = requireRequestUserId(req);
      const sourceId = String(req.body?.sourceId || "");
      const targetId = String(req.body?.targetId || "");
      if (!sourceId || !targetId) return res.status(400).json({ error: "sourceId and targetId are required" });
      res.json(await LexiconAuthorityService.mergeEntries(sourceId, targetId, reviewer));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Merging entries failed" });
    }
  });
}

export default registerLexiconRoutes;
