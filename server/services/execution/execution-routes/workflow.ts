import type { Express, Request, Response } from "express";

import { isAuthenticated } from "../../../localAuth";
import { EmailInboxWatchdog } from "../../workflow/EmailInboxWatchdog";
import { MeetingFollowUpGenerator } from "../../workflow/MeetingFollowUpGenerator";
import { PriorityClassificationEngine } from "../../workflow/PriorityClassificationEngine";
import { SchedulingAssistant } from "../../workflow/SchedulingAssistant";
import { VoiceMatchedDraftingEngine } from "../../workflow/VoiceMatchedDraftingEngine";

import { userIdFrom } from "./shared";

/**
 * Workflow layer (Demi-style) — inbox triage, priority classifier,
 * voice-matched drafting, meeting scheduling, and meeting follow-up
 * generation. Each endpoint is a thin shell over a pure engine.
 */
export function registerWorkflowEndpoints(app: Express): void {
  app.post(
    "/api/workflow/inbox/inspect",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { messages } = req.body || {};
        if (!Array.isArray(messages)) {
          return res.status(400).json({ error: "messages array is required" });
        }
        const findings = await EmailInboxWatchdog.inspect(messages);
        res.json({ findings });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "inspect failed" });
      }
    },
  );

  app.post(
    "/api/workflow/classify",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const result = PriorityClassificationEngine.classify(req.body || {});
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "classify failed" });
      }
    },
  );

  app.post("/api/workflow/draft", isAuthenticated, async (req: any, res: Response) => {
    try {
      const user_id = userIdFrom(req);
      const { thread_summary, desired_intent, voice_samples, context } = req.body || {};
      if (!thread_summary || !desired_intent) {
        return res
          .status(400)
          .json({ error: "thread_summary and desired_intent are required" });
      }
      const draft = VoiceMatchedDraftingEngine.draft({
        user_id,
        thread_summary,
        desired_intent,
        voice_samples,
        context,
      });
      res.json(draft);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "draft failed" });
    }
  });

  app.post(
    "/api/workflow/scheduling",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const user_id = userIdFrom(req);
        const { preferred_duration_minutes, message_excerpt, availability, timezone } =
          req.body || {};
        const draft = SchedulingAssistant.prepare({
          user_id,
          preferred_duration_minutes: Number(preferred_duration_minutes) || 30,
          message_excerpt: message_excerpt || "",
          availability,
          timezone,
        });
        res.json(draft);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "scheduling failed" });
      }
    },
  );

  app.post(
    "/api/workflow/meeting-follow-up",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const user_id = userIdFrom(req);
        const { meeting_title, participants, notes_or_transcript, occurred_at } =
          req.body || {};
        if (!meeting_title || !notes_or_transcript) {
          return res
            .status(400)
            .json({ error: "meeting_title and notes_or_transcript are required" });
        }
        const result = MeetingFollowUpGenerator.generate({
          user_id,
          meeting_title,
          participants,
          notes_or_transcript,
          occurred_at,
        });
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "follow-up failed" });
      }
    },
  );
}
