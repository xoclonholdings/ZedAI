import { describe, expect, it, vi } from "vitest";

import { createOwnerContext } from "../auth/OwnerContext";
import { ExecutiveOperationsService } from "./ExecutiveOperationsService";
import type {
  ExecutiveEffectAdapter,
  ExecutiveApprovalVerifier,
  ExecutiveIntegrationResolver,
  ExecutiveOperationRequest,
} from "./types";

vi.mock("../RuntimeLogger", () => ({ logRuntimeEvent: vi.fn() }));

const owner = createOwnerContext("account-123");

const readyResolver: ExecutiveIntegrationResolver = {
  resolve: vi.fn(async (_ownerUserId, requirement) => ({
    integration: requirement.integration,
    configured: true,
    owner_bound: true,
    adapter_available: true,
    granted_scopes: requirement.required_scopes,
    detail: "Ready for test execution.",
  })),
};

const verifiedApprovalVerifier: ExecutiveApprovalVerifier = {
  verify: vi.fn(async () => ({
    valid: true,
    detail: "ZENA verified the approval for the exact action scope.",
  })),
};

function verifiedRecipient() {
  return {
    recipient_id: "recipient-1",
    display_name: "Verified Recipient",
    destination: "recipient@example.com",
    channel: "email" as const,
    verification_state: "verified" as const,
  };
}

function emailSendRequest(): ExecutiveOperationRequest {
  return {
    kind: "email_send",
    objective: "Send the approved project update",
    recipients: [verifiedRecipient()],
    communication: {
      thread_summary: "the project update",
      desired_intent: "Confirm that the draft is ready for review",
      subject: "Project update",
    },
  };
}

describe("ExecutiveOperationsService", () => {
  it("does not invent calendar availability", async () => {
    const service = new ExecutiveOperationsService(readyResolver);
    const operation = await service.prepare(owner, {
      kind: "calendar_schedule",
      objective: "Schedule a planning meeting",
      recipients: [
        {
          ...verifiedRecipient(),
          channel: "calendar",
        },
      ],
      calendar: { preferred_duration_minutes: 30 },
    });

    expect(operation.state).toBe("blocked");
    expect(operation.blockers).toContainEqual(
      expect.objectContaining({ code: "availability_required" }),
    );
  });

  it("detects conflicts using only authorized calendar events", async () => {
    const service = new ExecutiveOperationsService(readyResolver);
    const operation = await service.prepare(owner, {
      kind: "calendar_review",
      objective: "Review today's calendar",
      calendar: {
        events: [
          {
            event_id: "event-1",
            title: "First",
            start: "2026-08-22T14:00:00.000Z",
            end: "2026-08-22T15:00:00.000Z",
            authorized: true,
          },
          {
            event_id: "event-2",
            title: "Second",
            start: "2026-08-22T14:30:00.000Z",
            end: "2026-08-22T15:30:00.000Z",
            authorized: true,
          },
          {
            event_id: "event-hidden",
            title: "Unauthorized",
            start: "2026-08-22T14:15:00.000Z",
            end: "2026-08-22T14:45:00.000Z",
            authorized: false,
          },
        ],
      },
    });

    expect(operation.state).toBe("completed");
    expect(operation.output).toMatchObject({
      conflict_count: 1,
      conflicts: [{ first_event_id: "event-1", second_event_id: "event-2" }],
    });
    expect(operation.output?.events).toHaveLength(2);
  });

  it("does not guess meeting action owners from participant names", async () => {
    const service = new ExecutiveOperationsService(readyResolver);
    const operation = await service.prepare(owner, {
      kind: "meeting_follow_up",
      objective: "Prepare the meeting follow-up",
      meeting: {
        meeting_title: "Launch review",
        participants: ["Jordan Smith"],
        notes_or_transcript: "Jordan will send the launch brief tomorrow.",
      },
    });

    const actionItems = operation.output?.action_items as Array<Record<string, unknown>>;
    expect(actionItems[0]).toMatchObject({
      owner: null,
      owner_resolution: "unresolved",
    });
    expect(operation.output?.task_seeds).toEqual([]);
  });

  it("accepts an explicit meeting owner only when the recipient is verified", async () => {
    const service = new ExecutiveOperationsService(readyResolver);
    const operation = await service.prepare(owner, {
      kind: "meeting_follow_up",
      objective: "Prepare the meeting follow-up",
      recipients: [verifiedRecipient()],
      meeting: {
        meeting_title: "Launch review",
        notes_or_transcript: "Action: send the launch brief tomorrow.",
        explicit_action_owners: [
          { line_match: "launch brief", recipient_id: "recipient-1" },
          { line_match: "launch brief", recipient_id: "unverified-recipient" },
        ],
      },
    });

    const actionItems = operation.output?.action_items as Array<Record<string, unknown>>;
    expect(actionItems[0]).toMatchObject({
      owner: "recipient-1",
      owner_resolution: "verified",
    });
    expect(operation.output?.task_seeds).toHaveLength(1);
  });

  it("blocks delegation when the assignee is not the verified recipient", async () => {
    const service = new ExecutiveOperationsService(readyResolver);
    const operation = await service.prepare(owner, {
      kind: "task_delegate",
      objective: "Delegate the project follow-up",
      recipients: [verifiedRecipient()],
      task: {
        title: "Send the project follow-up",
        assignee_recipient_id: "different-recipient",
      },
    });

    expect(operation.state).toBe("blocked");
    expect(operation.blockers).toContainEqual(
      expect.objectContaining({ code: "recipient_unresolved" }),
    );
  });

  it("uses only authorized sources in a project briefing", async () => {
    const service = new ExecutiveOperationsService(readyResolver);
    const operation = await service.prepare(owner, {
      kind: "project_briefing",
      objective: "Brief project alpha",
      project_id: "project-alpha",
      sources: [
        {
          source_id: "source-1",
          source_type: "project",
          title: "Authorized update",
          summary: "The milestone is ready.",
          authorized: true,
          project_id: "project-alpha",
        },
        {
          source_id: "source-2",
          source_type: "email",
          title: "Unauthorized email",
          summary: "Must not be included.",
          authorized: false,
          project_id: "project-alpha",
        },
      ],
    });

    expect(operation.state).toBe("completed");
    expect(operation.output?.items).toHaveLength(1);
    expect(operation.output?.excluded_unauthorized_sources).toBe(1);
  });

  it("honors explicit user priority over heuristic wording", async () => {
    const service = new ExecutiveOperationsService(readyResolver);
    const operation = await service.prepare(owner, {
      kind: "priority_review",
      objective: "Rank current commitments",
      priority_items: [
        {
          item_id: "item-1",
          title: "Routine check",
          signals: { user_priority: "urgent" },
        },
      ],
    });

    const items = operation.output?.items as Array<any>;
    expect(items[0].classification.priority).toBe("urgent");
  });

  it("blocks ambiguous recipients before approval", async () => {
    const service = new ExecutiveOperationsService(readyResolver);
    const request = emailSendRequest();
    request.recipients = [
      {
        ...verifiedRecipient(),
        verification_state: "ambiguous",
      },
    ];
    const operation = await service.prepare(owner, request);

    expect(operation.state).toBe("blocked");
    expect(operation.blockers).toContainEqual(
      expect.objectContaining({ code: "recipient_unresolved" }),
    );
    expect(operation.approval_requirement).toBeUndefined();
  });

  it("requires the exact approved scope before execution", async () => {
    const adapter: ExecutiveEffectAdapter = {
      effect: "send",
      execute: vi.fn(async () => ({
        outcome: "accepted" as const,
        detail: "Verified delivery.",
        evidence: [
          {
            evidence_type: "provider_delivery",
            reference: "delivery-1",
            observed_at: new Date().toISOString(),
            verified: true,
          },
        ],
      })),
    };
    const service = new ExecutiveOperationsService(readyResolver, [adapter]);
    const prepared = await service.prepare(owner, emailSendRequest());
    expect(prepared.state).toBe("awaiting_approval");

    const changed = {
      ...prepared,
      output: { ...prepared.output, subject: "Changed after approval" },
    };
    const result = await service.execute(owner, {
      operation: changed,
      approval: {
        approved: true,
        approval_reference: "zena-approval-1",
        action_fingerprint: prepared.approval_requirement!.action_fingerprint,
        approved_at: new Date().toISOString(),
      },
    });

    expect(result.state).toBe("blocked");
    expect(result.blockers).toContainEqual(
      expect.objectContaining({ code: "approval_scope_changed" }),
    );
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it("does not accept client-supplied approval fields as ZENA authority", async () => {
    const adapter: ExecutiveEffectAdapter = {
      effect: "send",
      execute: vi.fn(async () => ({
        outcome: "accepted" as const,
        detail: "Should not execute.",
        evidence: [],
      })),
    };
    const service = new ExecutiveOperationsService(readyResolver, [adapter]);
    const prepared = await service.prepare(owner, emailSendRequest());
    const result = await service.execute(owner, {
      operation: prepared,
      approval: {
        approved: true,
        approval_reference: "client-invented-reference",
        action_fingerprint: prepared.approval_requirement!.action_fingerprint,
        approved_at: new Date().toISOString(),
      },
    });

    expect(result.state).toBe("blocked");
    expect(result.blockers).toContainEqual(
      expect.objectContaining({ code: "approval_verification_required" }),
    );
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it("reports an accepted but unverified external effect as partial", async () => {
    const adapter: ExecutiveEffectAdapter = {
      effect: "send",
      execute: vi.fn(async () => ({
        outcome: "accepted" as const,
        detail: "Provider accepted the message but delivery is unverified.",
        evidence: [
          {
            evidence_type: "provider_acceptance",
            reference: "message-1",
            observed_at: new Date().toISOString(),
            verified: false,
          },
        ],
      })),
    };
    const service = new ExecutiveOperationsService(
      readyResolver,
      [adapter],
      verifiedApprovalVerifier,
    );
    const prepared = await service.prepare(owner, emailSendRequest());
    const result = await service.execute(owner, {
      operation: prepared,
      approval: {
        approved: true,
        approval_reference: "zena-approval-2",
        action_fingerprint: prepared.approval_requirement!.action_fingerprint,
        approved_at: new Date().toISOString(),
      },
    });

    expect(result.state).toBe("partial");
    expect(result.verification_evidence[0].verified).toBe(false);
  });

  it("marks an external effect completed only with verified evidence", async () => {
    const adapter: ExecutiveEffectAdapter = {
      effect: "send",
      execute: vi.fn(async () => ({
        outcome: "accepted" as const,
        detail: "Provider verified delivery.",
        evidence: [
          {
            evidence_type: "provider_delivery",
            reference: "delivery-2",
            observed_at: new Date().toISOString(),
            verified: true,
          },
        ],
      })),
    };
    const service = new ExecutiveOperationsService(
      readyResolver,
      [adapter],
      verifiedApprovalVerifier,
    );
    const prepared = await service.prepare(owner, emailSendRequest());
    const result = await service.execute(owner, {
      operation: prepared,
      approval: {
        approved: true,
        approval_reference: "zena-approval-3",
        action_fingerprint: prepared.approval_requirement!.action_fingerprint,
        approved_at: new Date().toISOString(),
      },
    });

    expect(result.state).toBe("completed");
    expect(result.verification_evidence).toEqual([
      expect.objectContaining({ verified: true, reference: "delivery-2" }),
    ]);
  });
});
