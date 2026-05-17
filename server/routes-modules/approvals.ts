import fs from "fs/promises";
import path from "path";
import type { Express } from "express";

import { isAdmin } from "../localAuth";
import { storage } from "../storage/databaseStorage";
import { HUB_SHARED_MEMORY_DIR } from "../utils/repoPaths";
import { insertMessageSchema } from "../../shared/schema";
import { logSecurityEvent } from "../services/SecurityAudit";

const WORKING_MEMORY_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "working/current-tasks.md");

/** Reshape a TaskRecord into the legacy approval-queue entry the admin
 *  UI was originally built against, so the front-end doesn't have to
 *  re-learn the new task lifecycle shape. */
function legacyEntryShape(task: any) {
  const draftLog = (task.logs || [])
    .map((l: any) => l.message || "")
    .find((m: string) => m.startsWith("Draft from "));
  const draft = draftLog ? draftLog.replace(/^Draft from [^:]+:\s*/, "") : "";
  const status =
    task.approval_status === "approved"
      ? "approved"
      : task.approval_status === "rejected"
        ? "rejected"
        : "pending";
  return {
    id: task.id,
    timestamp: task.created_at,
    status,
    userId: task.user_id,
    conversationId: task.conversation_id || null,
    message:
      task.plan?.summary?.replace(/^\[[^\]]+\]\s*Prepared\s+\w+\s+plan\s+for:\s*/i, "") || "",
    draft,
    agent: (task.plan?.summary || "").match(/\[([A-Za-z]+Agent)\]/)?.[1] || "Agent",
    resolvedAt: task.approved_at || null,
    rejectionReason: task.approval_status === "rejected" ? task.approval_reason : undefined,
    approvalStatus: task.approval_status,
    approvalRole: task.approval_role,
    approvalReason: task.approval_reason,
    executionResult: task.last_result?.execution_result || null,
  };
}

/** Append an "approved & executed" footprint to working memory and
 *  post a confirmation bubble to the conversation when one is attached. */
async function postApprovalConfirmationToConversation(task: any): Promise<string> {
  const timestamp = new Date().toISOString();
  const message = task.plan?.summary || `Task ${task.id}`;
  const summary = `\n## [${timestamp}] ✅ APPROVED & EXECUTED — User: ${task.user_id}\n**Request**: ${message}\n`;
  try {
    await fs.appendFile(WORKING_MEMORY_PATH, summary);
  } catch (err) {
    console.warn("[ApprovalExecutor] Working memory write failed:", err);
  }
  if (task.conversation_id) {
    try {
      const execMessage = `✅ **Action Approved**\n\nYour request has been reviewed and approved by the admin.\n\n**Request**: ${message}`;
      await storage.createMessage(
        insertMessageSchema.parse({
          conversationId: task.conversation_id,
          role: "assistant",
          content: execMessage,
        }),
      );
    } catch (err) {
      console.warn("[ApprovalExecutor] Conversation message failed:", err);
    }
  }
  return `Approved at ${timestamp}${task.conversation_id ? " and posted to conversation" : ""}.`;
}

export function registerApprovalRoutes(app: Express): void {
  app.get("/api/admin/approval-queue", isAdmin, async (_req, res) => {
    try {
      const { TaskLifecycleManager } = await import("../services/execution/TaskLifecycleManager");
      const tasks = await TaskLifecycleManager.list();
      const pendingStates = new Set([
        "user_required",
        "admin_required",
        "manual_handling_required",
      ]);
      const interesting = tasks.filter(
        (t) =>
          (t.approval_status && pendingStates.has(t.approval_status)) ||
          t.status === "blocked",
      );
      const recent = tasks
        .filter((t) => t.approval_status === "approved" || t.approval_status === "rejected")
        .slice(0, 10);
      const merged = [...interesting, ...recent];
      res.json({ version: "2.0", entries: merged.map(legacyEntryShape) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to read approval queue" });
    }
  });

  app.post("/api/admin/approve/:id", isAdmin, async (req: any, res) => {
    const { id } = req.params;
    try {
      const { ApprovalDecisionHandler } = await import(
        "../services/approval/ApprovalDecisionHandler"
      );
      const result = await ApprovalDecisionHandler.decide({
        task_id: id,
        decided_by: req.user?.claims?.sub || "admin",
        decider_role: "admin",
        action: "approve",
      });
      if (!result.ok || !result.task) {
        return res.status(404).json({ error: result.message });
      }
      const exec = await postApprovalConfirmationToConversation(result.task);
      await logSecurityEvent({
        type: "approval.approved",
        userId: req.user?.claims?.sub,
        detail: `Approved task ${id}: ${(result.task.plan?.summary || "").slice(0, 80)}`,
      });
      res.json({
        success: true,
        entry: { ...legacyEntryShape(result.task), executionResult: exec },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Approve failed" });
    }
  });

  app.post("/api/admin/reject/:id", isAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    try {
      const { ApprovalDecisionHandler } = await import(
        "../services/approval/ApprovalDecisionHandler"
      );
      const result = await ApprovalDecisionHandler.decide({
        task_id: id,
        decided_by: req.user?.claims?.sub || "admin",
        decider_role: "admin",
        action: "reject",
        reason: reason || "Rejected by admin",
      });
      if (!result.ok || !result.task) {
        return res.status(404).json({ error: result.message });
      }
      await logSecurityEvent({
        type: "approval.rejected",
        userId: req.user?.claims?.sub,
        detail: `Rejected task ${id}: ${(result.task.plan?.summary || "").slice(0, 80)} — ${reason || "no reason"}`,
      });
      res.json({ success: true, entry: legacyEntryShape(result.task) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Reject failed" });
    }
  });
}
