import type { InboxMessage } from "../workflow/EmailInboxWatchdog";
import type { Availability } from "../workflow/SchedulingAssistant";
import type { VoiceSample } from "../workflow/VoiceMatchedDraftingEngine";

export type ExecutiveOperationKind =
  | "calendar_review"
  | "calendar_schedule"
  | "calendar_reschedule"
  | "calendar_cancel"
  | "calendar_invite"
  | "email_triage"
  | "email_draft"
  | "email_send"
  | "message_triage"
  | "message_draft"
  | "message_send"
  | "meeting_prepare"
  | "meeting_follow_up"
  | "daily_briefing"
  | "project_briefing"
  | "priority_review"
  | "task_create"
  | "task_delegate"
  | "share"
  | "change_commitment";

export type ExecutiveOperationState =
  | "prepared"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "completed"
  | "blocked"
  | "failed"
  | "partial"
  | "cancelled";

export type ExecutiveEffect =
  | "send"
  | "schedule"
  | "reschedule"
  | "cancel"
  | "invite"
  | "share"
  | "change_commitment"
  | "delegate";

export type ExecutiveIntegration =
  | "calendar"
  | "email"
  | "messaging"
  | "crm"
  | "projects";

export type ExecutiveIntegrationAccess = "read" | "write";

export interface ExecutiveOwnership {
  coordinator: "ZAR";
  governor: "ZCOS";
  communication_owner: "ZENO Unite";
  automation_owner: "ZYLO Automate";
  integration_owner: "Settings -> Integrations";
  security_owner: "ZENA";
}

export interface ExecutiveRecipient {
  recipient_id: string;
  display_name: string;
  destination: string;
  channel: "email" | "calendar" | "sms" | "messaging";
  verification_state: "verified" | "unresolved" | "ambiguous";
  relationship_context?: string;
}

export interface ExecutiveSource {
  source_id: string;
  source_type:
    | "calendar"
    | "email"
    | "message"
    | "meeting"
    | "project"
    | "task"
    | "memory"
    | "knowledge"
    | "file";
  title: string;
  summary: string;
  authorized: boolean;
  occurred_at?: string;
  deadline?: string;
  project_id?: string;
}

export interface ExecutiveCalendarEvent {
  event_id: string;
  title: string;
  start: string;
  end: string;
  authorized: boolean;
  participant_ids?: string[];
  location?: string;
}

export interface ExecutivePrioritySignals {
  deadline?: string;
  dependency_count?: number;
  blocks_others?: boolean;
  commitment?: boolean;
  goal_alignment?: "none" | "supporting" | "direct";
  user_priority?: "low" | "normal" | "high" | "urgent";
}

export interface ExecutivePriorityItem {
  item_id: string;
  title: string;
  body?: string;
  sender?: string;
  received_at?: string;
  signals?: ExecutivePrioritySignals;
}

export interface ExecutiveMeetingInput {
  meeting_title: string;
  objective?: string;
  participants?: string[];
  notes_or_transcript?: string;
  occurred_at?: string;
  agenda_items?: string[];
  explicit_action_owners?: Array<{
    line_match: string;
    recipient_id: string;
  }>;
}

export interface ExecutiveCommunicationInput {
  thread_summary?: string;
  desired_intent?: string;
  subject?: string;
  body?: string;
  voice_samples?: VoiceSample[];
  messages?: InboxMessage[];
}

export interface ExecutiveCalendarInput {
  events?: ExecutiveCalendarEvent[];
  availability?: Availability[];
  preferred_duration_minutes?: number;
  message_excerpt?: string;
  timezone?: string;
  title?: string;
}

export interface ExecutiveTaskInput {
  title: string;
  description?: string;
  assignee_recipient_id?: string;
  deadline?: string;
  dependencies?: string[];
}

export interface ExecutiveOperationRequest {
  kind: ExecutiveOperationKind;
  objective: string;
  project_id?: string;
  recipients?: ExecutiveRecipient[];
  sources?: ExecutiveSource[];
  calendar?: ExecutiveCalendarInput;
  communication?: ExecutiveCommunicationInput;
  meeting?: ExecutiveMeetingInput;
  priority_items?: ExecutivePriorityItem[];
  task?: ExecutiveTaskInput;
  effect_payload?: Record<string, unknown>;
}

export interface ExecutiveIntegrationRequirement {
  integration: ExecutiveIntegration;
  access: ExecutiveIntegrationAccess;
  required_scopes: string[];
  setting_path: string;
  reason: string;
}

export interface ExecutiveIntegrationStatus {
  integration: ExecutiveIntegration;
  configured: boolean;
  owner_bound: boolean;
  adapter_available: boolean;
  granted_scopes: string[];
  detail: string;
}

export interface ExecutiveConnectionRequirement
  extends ExecutiveIntegrationRequirement {
  missing: Array<"configuration" | "owner_binding" | "scope" | "capability_adapter">;
}

export interface ExecutiveBlocker {
  code:
    | "objective_required"
    | "authorized_sources_required"
    | "availability_required"
    | "recipient_required"
    | "recipient_unresolved"
    | "integration_required"
    | "approval_required"
    | "approval_verification_required"
    | "approval_expired"
    | "approval_scope_changed"
    | "capability_adapter_required"
    | "invalid_input";
  message: string;
  connection_requirement?: ExecutiveConnectionRequirement;
  recipient_ids?: string[];
}

export interface ExecutiveApprovalRequirement {
  effect: ExecutiveEffect;
  action_fingerprint: string;
  recipients: Array<Pick<ExecutiveRecipient, "recipient_id" | "destination" | "channel">>;
  expires_at: string;
  reason: string;
}

export interface ExecutiveApproval {
  approved: true;
  approval_reference: string;
  action_fingerprint: string;
  approved_at: string;
}

export interface ExecutiveApprovalVerification {
  valid: boolean;
  detail: string;
}

export interface ExecutiveVerificationEvidence {
  evidence_type: string;
  reference: string;
  observed_at: string;
  verified: boolean;
  detail?: string;
}

export interface PreparedExecutiveOperation {
  operation_id: string;
  owner_user_id: string;
  kind: ExecutiveOperationKind;
  objective: string;
  project_id?: string;
  state: ExecutiveOperationState;
  ownership: ExecutiveOwnership;
  recipients: ExecutiveRecipient[];
  output?: Record<string, unknown>;
  effect?: ExecutiveEffect;
  effect_payload?: Record<string, unknown>;
  approval_requirement?: ExecutiveApprovalRequirement;
  integration_requirements: ExecutiveIntegrationRequirement[];
  integration_statuses: ExecutiveIntegrationStatus[];
  blockers: ExecutiveBlocker[];
  verification_evidence: ExecutiveVerificationEvidence[];
  created_at: string;
  updated_at: string;
}

export interface ExecuteExecutiveOperationRequest {
  operation: PreparedExecutiveOperation;
  approval: ExecutiveApproval;
}

export interface ExecutiveEffectAdapterResult {
  outcome: "accepted" | "rejected" | "unknown";
  evidence: ExecutiveVerificationEvidence[];
  detail: string;
}

export interface ExecutiveEffectAdapter {
  effect: ExecutiveEffect;
  execute(input: {
    operation: PreparedExecutiveOperation;
    approval: ExecutiveApproval;
  }): Promise<ExecutiveEffectAdapterResult>;
}

export interface ExecutiveIntegrationResolver {
  resolve(
    owner_user_id: string,
    requirement: ExecutiveIntegrationRequirement,
  ): Promise<ExecutiveIntegrationStatus>;
}

export interface ExecutiveApprovalVerifier {
  verify(
    owner_user_id: string,
    operation: PreparedExecutiveOperation,
    approval: ExecutiveApproval,
  ): Promise<ExecutiveApprovalVerification>;
}
