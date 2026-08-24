import { createHash, randomUUID } from "crypto";

import { assertOwnerContext, type OwnerContext } from "../auth/OwnerContext";
import { logRuntimeEvent } from "../RuntimeLogger";
import { EmailInboxWatchdog } from "../workflow/EmailInboxWatchdog";
import { MeetingFollowUpGenerator } from "../workflow/MeetingFollowUpGenerator";
import { PriorityClassificationEngine } from "../workflow/PriorityClassificationEngine";
import { SchedulingAssistant } from "../workflow/SchedulingAssistant";
import { VoiceMatchedDraftingEngine } from "../workflow/VoiceMatchedDraftingEngine";
import { SettingsExecutiveIntegrationResolver } from "./SettingsExecutiveIntegrationResolver";
import type {
  ExecutiveApprovalRequirement,
  ExecutiveApprovalVerifier,
  ExecutiveBlocker,
  ExecutiveCalendarEvent,
  ExecutiveConnectionRequirement,
  ExecutiveEffect,
  ExecutiveEffectAdapter,
  ExecutiveIntegrationRequirement,
  ExecutiveIntegrationResolver,
  ExecutiveIntegrationStatus,
  ExecutiveOperationKind,
  ExecutiveOperationRequest,
  ExecutiveOwnership,
  ExecutiveRecipient,
  ExecutiveSource,
  ExecuteExecutiveOperationRequest,
  PreparedExecutiveOperation,
} from "./types";

const OWNERSHIP: ExecutiveOwnership = {
  coordinator: "ZAR",
  governor: "ZCOS",
  communication_owner: "ZENO Unite",
  automation_owner: "ZYLO Automate",
  integration_owner: "Settings -> Integrations",
  security_owner: "ZENA",
};

const EFFECT_BY_KIND: Partial<Record<ExecutiveOperationKind, ExecutiveEffect>> = {
  calendar_schedule: "schedule",
  calendar_reschedule: "reschedule",
  calendar_cancel: "cancel",
  calendar_invite: "invite",
  email_send: "send",
  message_send: "send",
  task_delegate: "delegate",
  share: "share",
  change_commitment: "change_commitment",
};

const RECIPIENT_REQUIRED_EFFECTS = new Set<ExecutiveEffect>([
  "send",
  "invite",
  "share",
  "delegate",
]);

const APPROVAL_TTL_MS = 15 * 60_000;

const DENY_UNVERIFIED_APPROVALS: ExecutiveApprovalVerifier = {
  async verify() {
    return {
      valid: false,
      detail:
        "A governed ZENA approval verifier is not registered. No external action was attempted.",
    };
  },
};

export class ExecutiveOperationsService {
  private readonly adapters: Map<ExecutiveEffect, ExecutiveEffectAdapter>;

  constructor(
    private readonly integrationResolver: ExecutiveIntegrationResolver =
      new SettingsExecutiveIntegrationResolver(),
    adapters: ExecutiveEffectAdapter[] = [],
    private readonly approvalVerifier: ExecutiveApprovalVerifier =
      DENY_UNVERIFIED_APPROVALS,
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.effect, adapter]));
  }

  async prepare(
    owner: OwnerContext,
    request: ExecutiveOperationRequest,
  ): Promise<PreparedExecutiveOperation> {
    assertOwnerContext(owner);
    const now = new Date().toISOString();
    const operation: PreparedExecutiveOperation = {
      operation_id: `exec-op-${randomUUID()}`,
      owner_user_id: owner.ownerUserId,
      kind: request.kind,
      objective: String(request.objective || "").trim(),
      project_id: request.project_id,
      state: "prepared",
      ownership: OWNERSHIP,
      recipients: request.recipients || [],
      effect: EFFECT_BY_KIND[request.kind],
      effect_payload: request.effect_payload,
      integration_requirements: this.integrationRequirements(request),
      integration_statuses: [],
      blockers: [],
      verification_evidence: [],
      created_at: now,
      updated_at: now,
    };

    if (!operation.objective) {
      operation.blockers.push({
        code: "objective_required",
        message: "The executive operation needs a specific objective.",
      });
    }

    operation.blockers.push(...this.recipientBlockers(operation, request));
    operation.output = await this.buildOutput(owner, request, operation.blockers);

    operation.integration_statuses = await Promise.all(
      operation.integration_requirements.map((requirement) =>
        this.integrationResolver.resolve(owner.ownerUserId, requirement),
      ),
    );
    operation.blockers.push(
      ...this.integrationBlockers(
        operation.integration_requirements,
        operation.integration_statuses,
      ),
    );

    if (operation.blockers.length) {
      operation.state = "blocked";
    } else if (operation.effect) {
      operation.approval_requirement = this.approvalRequirement(operation);
      operation.state = "awaiting_approval";
    } else if (
      [
        "calendar_review",
        "email_triage",
        "message_triage",
        "daily_briefing",
        "project_briefing",
        "priority_review",
      ].includes(operation.kind)
    ) {
      operation.state = "completed";
    }

    await this.trace(operation, "prepared");
    return operation;
  }

  async execute(
    owner: OwnerContext,
    request: ExecuteExecutiveOperationRequest,
  ): Promise<PreparedExecutiveOperation> {
    assertOwnerContext(owner);
    const operation = this.copyOperation(request.operation);
    operation.updated_at = new Date().toISOString();

    if (operation.owner_user_id !== owner.ownerUserId) {
      return this.block(operation, {
        code: "approval_scope_changed",
        message: "The operation owner no longer matches the authenticated owner.",
      });
    }

    const approvalRequirement = operation.approval_requirement;
    if (!approvalRequirement) {
      return this.block(operation, {
        code: "approval_required",
        message: "This external effect has no action-specific approval contract.",
      });
    }

    const currentFingerprint = this.actionFingerprint(operation);
    if (
      request.approval.action_fingerprint !== approvalRequirement.action_fingerprint ||
      currentFingerprint !== approvalRequirement.action_fingerprint
    ) {
      return this.block(operation, {
        code: "approval_scope_changed",
        message:
          "The operation, recipients, destination, or payload changed after approval was prepared. New approval is required.",
      });
    }

    const approvedAt = new Date(request.approval.approved_at).getTime();
    const expiresAt = new Date(approvalRequirement.expires_at).getTime();
    const createdAt = new Date(operation.created_at).getTime();
    const now = Date.now();
    if (
      !Number.isFinite(approvedAt) ||
      !Number.isFinite(createdAt) ||
      approvedAt < createdAt ||
      approvedAt > expiresAt ||
      approvedAt > now + 60_000 ||
      now > expiresAt
    ) {
      return this.block(operation, {
        code: "approval_expired",
        message: "The action-specific approval expired. New approval is required.",
      });
    }

    if (!request.approval.approval_reference?.trim()) {
      return this.block(operation, {
        code: "approval_verification_required",
        message:
          "The action-specific approval has no ZENA approval reference. No external action was attempted.",
      });
    }

    try {
      const approvalVerification = await this.approvalVerifier.verify(
        owner.ownerUserId,
        operation,
        request.approval,
      );
      if (!approvalVerification.valid) {
        return this.block(operation, {
          code: "approval_verification_required",
          message: approvalVerification.detail,
        });
      }
    } catch {
      return this.block(operation, {
        code: "approval_verification_required",
        message:
          "ZENA could not verify the action-specific approval. No external action was attempted.",
      });
    }

    const statuses = await Promise.all(
      operation.integration_requirements.map((requirement) =>
        this.integrationResolver.resolve(owner.ownerUserId, requirement),
      ),
    );
    operation.integration_statuses = statuses;
    const integrationBlockers = this.integrationBlockers(
      operation.integration_requirements,
      statuses,
    );
    if (integrationBlockers.length) {
      return this.block(operation, integrationBlockers[0]);
    }

    if (!operation.effect) {
      return this.block(operation, {
        code: "invalid_input",
        message: "The prepared operation does not contain an external effect.",
      });
    }

    const adapter = this.adapters.get(operation.effect);
    if (!adapter) {
      return this.block(operation, {
        code: "capability_adapter_required",
        message:
          "The governed provider adapter for this external effect is not installed. No external action was attempted.",
      });
    }

    operation.state = "approved";
    await this.trace(operation, "approved");
    operation.state = "running";
    await this.trace(operation, "running");

    try {
      const result = await adapter.execute({
        operation,
        approval: request.approval,
      });
      operation.verification_evidence = result.evidence || [];
      const fullyVerified =
        result.outcome === "accepted" &&
        operation.verification_evidence.length > 0 &&
        operation.verification_evidence.every((evidence) => evidence.verified);

      if (fullyVerified) operation.state = "completed";
      else if (result.outcome === "rejected") operation.state = "failed";
      else operation.state = "partial";

      operation.output = {
        ...(operation.output || {}),
        execution_detail: result.detail,
      };
    } catch (error) {
      operation.state = "failed";
      operation.output = {
        ...(operation.output || {}),
        execution_detail:
          error instanceof Error ? error.message : "Executive operation failed.",
      };
    }

    operation.updated_at = new Date().toISOString();
    await this.trace(operation, "executed");
    return operation;
  }

  private async buildOutput(
    owner: OwnerContext,
    request: ExecutiveOperationRequest,
    blockers: ExecutiveBlocker[],
  ): Promise<Record<string, unknown> | undefined> {
    switch (request.kind) {
      case "calendar_review":
        return this.reviewCalendar(request.calendar?.events || [], blockers);
      case "calendar_schedule": {
        const availability = request.calendar?.availability || [];
        if (!availability.length) {
          blockers.push({
            code: "availability_required",
            message:
              "Verified calendar availability is required. Connect Calendar in Settings -> Integrations or provide authorized availability windows.",
          });
          return undefined;
        }
        return {
          scheduling_draft: SchedulingAssistant.prepare({
            user_id: owner.ownerUserId,
            preferred_duration_minutes:
              request.calendar?.preferred_duration_minutes || 30,
            message_excerpt:
              request.calendar?.message_excerpt || request.objective,
            availability,
            timezone: request.calendar?.timezone,
          }),
        };
      }
      case "email_triage":
      case "message_triage": {
        const messages = request.communication?.messages || [];
        if (!messages.length) return undefined;
        return { findings: await EmailInboxWatchdog.inspect(messages) };
      }
      case "email_draft":
      case "message_draft":
      case "email_send":
      case "message_send": {
        const threadSummary = request.communication?.thread_summary?.trim();
        const desiredIntent = request.communication?.desired_intent?.trim();
        if (!threadSummary || !desiredIntent) {
          blockers.push({
            code: "invalid_input",
            message: "thread_summary and desired_intent are required for drafting.",
          });
          return undefined;
        }
        const draft = VoiceMatchedDraftingEngine.draft({
          user_id: owner.ownerUserId,
          thread_summary: threadSummary,
          desired_intent: desiredIntent,
          voice_samples: request.communication?.voice_samples,
          context: request.effect_payload,
        });
        return {
          draft,
          subject: request.communication?.subject,
          sent: false,
        };
      }
      case "meeting_prepare":
        return this.prepareMeeting(request, blockers);
      case "meeting_follow_up": {
        const meeting = request.meeting;
        if (!meeting?.meeting_title || !meeting.notes_or_transcript) {
          blockers.push({
            code: "invalid_input",
            message:
              "meeting_title and notes_or_transcript are required for meeting follow-up.",
          });
          return undefined;
        }
        const verifiedRecipientIds = new Set(
          (request.recipients || [])
            .filter((recipient) => recipient.verification_state === "verified")
            .map((recipient) => recipient.recipient_id),
        );
        return MeetingFollowUpGenerator.generate({
          user_id: owner.ownerUserId,
          meeting_title: meeting.meeting_title,
          participants: meeting.participants,
          notes_or_transcript: meeting.notes_or_transcript,
          occurred_at: meeting.occurred_at,
          explicit_action_owners: (meeting.explicit_action_owners || []).filter(
            (mapping) => verifiedRecipientIds.has(mapping.recipient_id),
          ),
        }) as unknown as Record<string, unknown>;
      }
      case "daily_briefing":
      case "project_briefing":
        return this.buildBriefing(request, blockers);
      case "priority_review":
        return this.rankPriorities(request);
      case "task_create":
      case "task_delegate": {
        if (!request.task?.title?.trim()) {
          blockers.push({
            code: "invalid_input",
            message: "A task title is required.",
          });
          return undefined;
        }
        return {
          capability_request: {
            capability: request.kind === "task_create" ? "zcos.task.create" : "zcos.task.delegate",
            project_id: request.project_id,
            task: request.task,
            owner_user_id: owner.ownerUserId,
          },
          executed: false,
        };
      }
      default:
        return request.effect_payload
          ? { prepared_effect: request.effect_payload, executed: false }
          : undefined;
    }
  }

  private reviewCalendar(
    events: ExecutiveCalendarEvent[],
    blockers: ExecutiveBlocker[],
  ): Record<string, unknown> | undefined {
    const authorized = events.filter((event) => event.authorized);
    if (!authorized.length) {
      blockers.push({
        code: "authorized_sources_required",
        message:
          "Calendar review requires authorized calendar events or a connected, owner-bound Calendar integration.",
      });
      return undefined;
    }

    const valid = authorized
      .filter((event) => this.validWindow(event.start, event.end))
      .sort((a, b) => a.start.localeCompare(b.start));
    if (valid.length !== authorized.length) {
      blockers.push({
        code: "invalid_input",
        message: "One or more calendar events had an invalid start or end time.",
      });
    }

    const conflicts: Array<{ first_event_id: string; second_event_id: string }> = [];
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        if (new Date(valid[j].start).getTime() >= new Date(valid[i].end).getTime()) {
          break;
        }
        conflicts.push({
          first_event_id: valid[i].event_id,
          second_event_id: valid[j].event_id,
        });
      }
    }

    return { events: valid, conflicts, conflict_count: conflicts.length };
  }

  private prepareMeeting(
    request: ExecutiveOperationRequest,
    blockers: ExecutiveBlocker[],
  ): Record<string, unknown> | undefined {
    const meeting = request.meeting;
    if (!meeting?.meeting_title) {
      blockers.push({
        code: "invalid_input",
        message: "meeting_title is required for meeting preparation.",
      });
      return undefined;
    }
    const sources = (request.sources || []).filter((source) => source.authorized);
    return {
      meeting_title: meeting.meeting_title,
      objective: meeting.objective || request.objective,
      participants: meeting.participants || [],
      agenda: meeting.agenda_items || [],
      source_collection: sources.map((source) => ({
        source_id: source.source_id,
        title: source.title,
        summary: source.summary,
      })),
      excluded_unauthorized_sources:
        (request.sources || []).length - sources.length,
    };
  }

  private buildBriefing(
    request: ExecutiveOperationRequest,
    blockers: ExecutiveBlocker[],
  ): Record<string, unknown> | undefined {
    const sources = (request.sources || []).filter((source) => {
      if (!source.authorized) return false;
      if (request.kind === "project_briefing" && request.project_id) {
        return source.project_id === request.project_id;
      }
      return true;
    });
    if (!sources.length) {
      blockers.push({
        code: "authorized_sources_required",
        message:
          "The briefing requires at least one authorized source in the requested scope.",
      });
      return undefined;
    }

    return {
      briefing_type: request.kind === "daily_briefing" ? "daily" : "project",
      project_id: request.project_id,
      items: sources
        .slice()
        .sort((a, b) => this.sourceOrder(a, b))
        .map((source) => ({
          source_id: source.source_id,
          source_type: source.source_type,
          title: source.title,
          summary: source.summary,
          deadline: source.deadline,
        })),
      excluded_unauthorized_sources:
        (request.sources || []).length - sources.length,
    };
  }

  private rankPriorities(request: ExecutiveOperationRequest): Record<string, unknown> {
    const ranked = (request.priority_items || []).map((item) => {
      const classification = PriorityClassificationEngine.classify({
        subject: item.title,
        body: item.body,
        sender: item.sender,
        received_at: item.received_at,
        priority_signals: item.signals,
      });
      return { ...item, classification };
    });
    const weight = { urgent: 4, high: 3, normal: 2, low: 1 } as const;
    ranked.sort(
      (a, b) =>
        weight[b.classification.priority] - weight[a.classification.priority],
    );
    return { items: ranked };
  }

  private recipientBlockers(
    operation: PreparedExecutiveOperation,
    request: ExecutiveOperationRequest,
  ): ExecutiveBlocker[] {
    if (!operation.effect) return [];
    const hasTarget = Boolean(operation.effect_payload?.target_id);
    if (
      RECIPIENT_REQUIRED_EFFECTS.has(operation.effect) &&
      !operation.recipients.length
    ) {
      return [
        {
          code: "recipient_required",
          message:
            "A verified recipient and destination are required. ZAR will not guess an identity.",
        },
      ];
    }
    if (!operation.recipients.length && !hasTarget) {
      return [
        {
          code: "recipient_required",
          message:
            "A verified recipient or exact target identifier is required for this commitment change.",
        },
      ];
    }
    const unresolved = operation.recipients.filter(
      (recipient) =>
        recipient.verification_state !== "verified" ||
        !recipient.recipient_id.trim() ||
        !recipient.destination.trim(),
    );
    if (unresolved.length) {
      return [
        {
          code: "recipient_unresolved",
          message:
            "One or more recipients are unresolved or ambiguous. Recipient verification is required before approval.",
          recipient_ids: unresolved.map((recipient) => recipient.recipient_id),
        },
      ];
    }

    if (operation.kind === "task_delegate") {
      const assigneeId = request.task?.assignee_recipient_id?.trim();
      const matchesVerifiedRecipient = operation.recipients.some(
        (recipient) =>
          recipient.verification_state === "verified" &&
          recipient.recipient_id === assigneeId,
      );
      if (!assigneeId || !matchesVerifiedRecipient) {
        return [
          {
            code: "recipient_unresolved",
            message:
              "The delegated task assignee must match an exact verified recipient record.",
            recipient_ids: assigneeId ? [assigneeId] : [],
          },
        ];
      }
    }

    return [];
  }

  private integrationRequirements(
    request: ExecutiveOperationRequest,
  ): ExecutiveIntegrationRequirement[] {
    const requirements: ExecutiveIntegrationRequirement[] = [];
    const add = (
      integration: ExecutiveIntegrationRequirement["integration"],
      access: ExecutiveIntegrationRequirement["access"],
      required_scopes: string[],
      reason: string,
    ) =>
      requirements.push({
        integration,
        access,
        required_scopes,
        setting_path: `Settings -> Integrations -> ${this.integrationLabel(integration)}`,
        reason,
      });

    if (request.kind === "calendar_review" && !request.calendar?.events?.length) {
      add("calendar", "read", ["calendar.read"], "Calendar events are required for review and conflict detection.");
    }
    if (request.kind === "email_triage" && !request.communication?.messages?.length) {
      add("email", "read", ["email.read"], "Inbox messages are required for triage.");
    }
    if (request.kind === "message_triage" && !request.communication?.messages?.length) {
      add("messaging", "read", ["messages.read"], "Messages are required for triage.");
    }
    if (["calendar_schedule", "calendar_reschedule", "calendar_cancel", "calendar_invite", "change_commitment"].includes(request.kind)) {
      add("calendar", "write", ["calendar.write"], "The operation would change an external calendar commitment.");
    }
    if (request.kind === "email_send") {
      add("email", "write", ["email.send"], "The operation would send an external email.");
    }
    if (request.kind === "message_send") {
      add("messaging", "write", ["messages.send"], "The operation would send an external message.");
    }
    if (["task_create", "task_delegate"].includes(request.kind)) {
      add("projects", "write", ["tasks.write"], "Task creation and delegation use the typed ZCOS Project capability.");
    }
    if (request.kind === "share") {
      add("projects", "write", ["projects.share"], "Sharing changes access to a ZCOS Project resource.");
    }
    return requirements;
  }

  private integrationBlockers(
    requirements: ExecutiveIntegrationRequirement[],
    statuses: ExecutiveIntegrationStatus[],
  ): ExecutiveBlocker[] {
    return requirements.flatMap((requirement, index) => {
      const status = statuses[index];
      const missing: ExecutiveConnectionRequirement["missing"] = [];
      if (!status?.configured) missing.push("configuration");
      if (!status?.owner_bound) missing.push("owner_binding");
      if (!this.hasScopes(status?.granted_scopes || [], requirement.required_scopes)) {
        missing.push("scope");
      }
      if (!status?.adapter_available) missing.push("capability_adapter");
      if (!missing.length) return [];
      const connection_requirement: ExecutiveConnectionRequirement = {
        ...requirement,
        missing,
      };
      return [
        {
          code: "integration_required" as const,
          message: `${requirement.setting_path} is not ready for this ${requirement.access} operation. ${status?.detail || requirement.reason}`,
          connection_requirement,
        },
      ];
    });
  }

  private approvalRequirement(
    operation: PreparedExecutiveOperation,
  ): ExecutiveApprovalRequirement {
    const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS).toISOString();
    const requirement: ExecutiveApprovalRequirement = {
      effect: operation.effect as ExecutiveEffect,
      action_fingerprint: "",
      recipients: operation.recipients.map((recipient) => ({
        recipient_id: recipient.recipient_id,
        destination: recipient.destination,
        channel: recipient.channel,
      })),
      expires_at: expiresAt,
      reason:
        "Sending, scheduling, cancelling, inviting, sharing, delegating, or changing a commitment requires action-specific approval.",
    };
    operation.approval_requirement = requirement;
    requirement.action_fingerprint = this.actionFingerprint(operation);
    return requirement;
  }

  private actionFingerprint(operation: PreparedExecutiveOperation): string {
    return createHash("sha256")
      .update(
        this.stableStringify({
          operation_id: operation.operation_id,
          owner_user_id: operation.owner_user_id,
          kind: operation.kind,
          objective: operation.objective,
          project_id: operation.project_id,
          effect: operation.effect,
          effect_payload: operation.effect_payload,
          output: operation.output,
          recipients: operation.recipients
            .map((recipient) => ({
              recipient_id: recipient.recipient_id,
              destination: recipient.destination,
              channel: recipient.channel,
              verification_state: recipient.verification_state,
            }))
            .sort((a, b) => a.recipient_id.localeCompare(b.recipient_id)),
        }),
      )
      .digest("hex");
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right));
      return `{${entries
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  private hasScopes(granted: string[], required: string[]): boolean {
    const normalized = granted.map((scope) => scope.toLowerCase());
    return required.every((scope) => {
      const expected = scope.toLowerCase();
      return normalized.some(
        (candidate) =>
          candidate === expected ||
          candidate.endsWith(`/${expected}`) ||
          candidate.endsWith(`.${expected}`),
      );
    });
  }

  private integrationLabel(
    integration: ExecutiveIntegrationRequirement["integration"],
  ): string {
    return {
      calendar: "Calendar",
      email: "Email",
      messaging: "Messaging",
      crm: "CRM",
      projects: "Projects",
    }[integration];
  }

  private validWindow(start: string, end: string): boolean {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime;
  }

  private sourceOrder(left: ExecutiveSource, right: ExecutiveSource): number {
    const leftDeadline = left.deadline ? new Date(left.deadline).getTime() : Number.POSITIVE_INFINITY;
    const rightDeadline = right.deadline ? new Date(right.deadline).getTime() : Number.POSITIVE_INFINITY;
    if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline;
    return (right.occurred_at || "").localeCompare(left.occurred_at || "");
  }

  private copyOperation(
    operation: PreparedExecutiveOperation,
  ): PreparedExecutiveOperation {
    return {
      ...operation,
      ownership: { ...operation.ownership },
      recipients: operation.recipients.map((recipient) => ({ ...recipient })),
      integration_requirements: operation.integration_requirements.map((item) => ({
        ...item,
        required_scopes: [...item.required_scopes],
      })),
      integration_statuses: operation.integration_statuses.map((item) => ({
        ...item,
        granted_scopes: [...item.granted_scopes],
      })),
      blockers: operation.blockers.map((blocker) => ({ ...blocker })),
      verification_evidence: operation.verification_evidence.map((evidence) => ({
        ...evidence,
      })),
      output: operation.output ? { ...operation.output } : undefined,
      effect_payload: operation.effect_payload
        ? { ...operation.effect_payload }
        : undefined,
      approval_requirement: operation.approval_requirement
        ? {
            ...operation.approval_requirement,
            recipients: operation.approval_requirement.recipients.map((recipient) => ({
              ...recipient,
            })),
          }
        : undefined,
    };
  }

  private async block(
    operation: PreparedExecutiveOperation,
    blocker: ExecutiveBlocker,
  ): Promise<PreparedExecutiveOperation> {
    operation.state = "blocked";
    operation.blockers = [...operation.blockers, blocker];
    operation.updated_at = new Date().toISOString();
    await this.trace(operation, "blocked");
    return operation;
  }

  private async trace(
    operation: PreparedExecutiveOperation,
    phase: string,
  ): Promise<void> {
    await logRuntimeEvent({
      level:
        operation.state === "failed"
          ? "error"
          : operation.state === "blocked" || operation.state === "partial"
            ? "warn"
            : "info",
      source: "server",
      event: `executive_operations.${phase}`,
      detail: `${operation.kind} -> ${operation.state}`,
      context: {
        operation_id: operation.operation_id,
        owner_user_id: operation.owner_user_id,
        project_id: operation.project_id,
        state: operation.state,
        blocker_codes: operation.blockers.map((blocker) => blocker.code),
      },
    });
  }
}

export default ExecutiveOperationsService;
