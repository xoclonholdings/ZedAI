import { afterEach, describe, expect, it, vi } from "vitest";

import { FlowStore } from "../FlowStore";
import { ApprovalDecisionHandler } from "../approval/ApprovalDecisionHandler";
import { createOwnerContext } from "./OwnerContext";
import { ExecutionApprovalHandler } from "../execution/ExecutionApprovalHandler";
import {
  TaskLifecycleManager,
  type TaskRecord,
} from "../execution/TaskLifecycleManager";
import { ToolOrchestrationEngine } from "../operational/ToolOrchestrationEngine";

function taskFor(userId: string): TaskRecord {
  return {
    id: "task-1",
    status: "pending",
    created_at: "2026-08-08T00:00:00.000Z",
    updated_at: "2026-08-08T00:00:00.000Z",
    retries: 0,
    logs: [],
    user_id: userId,
    plan: {
      task_id: "task-1",
      task_type: "general",
      execution_mode: "digital",
      user_request: "Test request",
      objective: "Test ownership",
      steps: [],
      approval_required: false,
      created_at: "2026-08-08T00:00:00.000Z",
    } as any,
  };
}

describe("owned service boundaries", () => {
  afterEach(() => vi.restoreAllMocks());

  it("filters task records by the authenticated owner", async () => {
    const task = taskFor("account-123");
    vi.spyOn(TaskLifecycleManager, "get").mockResolvedValue(task);

    await expect(
      TaskLifecycleManager.getForOwner(
        task.id,
        createOwnerContext("account-123"),
      ),
    ).resolves.toBe(task);
    await expect(
      TaskLifecycleManager.getForOwner(
        task.id,
        createOwnerContext("account-456"),
      ),
    ).resolves.toBeNull();
  });

  it("filters Flow runs by the authenticated owner", async () => {
    const run = { id: "run-1", userId: "account-123" } as any;
    vi.spyOn(FlowStore, "getRun").mockResolvedValue(run);

    await expect(
      FlowStore.getRunForOwner(run.id, createOwnerContext("account-123")),
    ).resolves.toBe(run);
    await expect(
      FlowStore.getRunForOwner(run.id, createOwnerContext("account-456")),
    ).resolves.toBeNull();
  });

  it("does not let a user decide another owner's task", async () => {
    vi.spyOn(TaskLifecycleManager, "get").mockResolvedValue(
      taskFor("account-123"),
    );
    const recordApproval = vi
      .spyOn(ExecutionApprovalHandler, "record")
      .mockResolvedValue({} as any);

    await expect(
      ApprovalDecisionHandler.decide({
        task_id: "task-1",
        decided_by: "account-456",
        decider_role: "user",
        action: "approve",
      }),
    ).resolves.toMatchObject({ ok: false, task: null });
    expect(recordApproval).not.toHaveBeenCalled();
  });

  it("does not orchestrate tools for an unowned task", async () => {
    vi.spyOn(TaskLifecycleManager, "getForOwner").mockResolvedValue(null);

    await expect(
      ToolOrchestrationEngine.run({
        task_id: "task-1",
        user_id: "account-456",
        steps: [],
        approved: true,
      }),
    ).rejects.toThrow("Task not found");
  });
});
