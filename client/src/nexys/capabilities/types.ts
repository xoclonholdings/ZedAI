import type { NexysNodeId } from "../graph/types";

export type NexysCapabilityId = string;

export type NexysCapabilityOwnerKind = "node" | "communication-layer";

export type NexysCapabilityStatus = "scaffolded" | "available" | "external" | "planned";

export type NexysCapabilityActionKind =
  | "navigate"
  | "read"
  | "write"
  | "execute"
  | "review"
  | "configure"
  | "connect"
  | "upload";

export type NexysPermissionSource = "kernel" | "zar-core" | "application" | "external";

export interface NexysCapabilityOwner {
  readonly kind: NexysCapabilityOwnerKind;
  readonly id: string;
}

export interface NexysCapabilityAction {
  readonly id: string;
  readonly label: string;
  readonly kind: NexysCapabilityActionKind;
  readonly route: string | null;
  readonly enabled: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NexysCapabilityDependency {
  readonly capabilityId: NexysCapabilityId;
  readonly required: boolean;
  readonly reason: string;
}

export interface NexysCapabilityPermission {
  readonly id: string;
  readonly label: string;
  readonly source: NexysPermissionSource;
  readonly required: boolean;
}

export interface NexysSearchableMetadata {
  readonly summary: string;
  readonly terms: readonly string[];
  readonly aliases: readonly string[];
}

export interface NexysCapabilityDefinition {
  readonly id: NexysCapabilityId;
  readonly owner: NexysCapabilityOwner;
  readonly owningNodeId: NexysNodeId | null;
  readonly label: string;
  readonly category: string;
  readonly status: NexysCapabilityStatus;
  readonly actions: readonly NexysCapabilityAction[];
  readonly dependencies: readonly NexysCapabilityDependency[];
  readonly permissions: readonly NexysCapabilityPermission[];
  readonly searchable: NexysSearchableMetadata;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface NexysCapabilityGraphEdge {
  readonly fromCapabilityId: NexysCapabilityId;
  readonly toCapabilityId: NexysCapabilityId;
  readonly required: boolean;
  readonly reason: string;
}

export interface NexysUnresolvedCapabilityDependency {
  readonly fromCapabilityId: NexysCapabilityId;
  readonly missingCapabilityId: NexysCapabilityId;
  readonly required: boolean;
  readonly reason: string;
}

export interface NexysCapabilityGraphSnapshot {
  readonly capabilities: readonly NexysCapabilityDefinition[];
  readonly edges: readonly NexysCapabilityGraphEdge[];
  readonly unresolvedDependencies: readonly NexysUnresolvedCapabilityDependency[];
}
