import type { NexusNodeId } from "../graph/types";

export type NexusCapabilityId = string;

export type NexusCapabilityOwnerKind = "node" | "communication-layer";

export type NexusCapabilityStatus = "scaffolded" | "available" | "external" | "planned";

export type NexusCapabilityActionKind =
  | "navigate"
  | "read"
  | "write"
  | "execute"
  | "review"
  | "configure"
  | "connect"
  | "upload";

export type NexusPermissionSource = "kernel" | "zar-core" | "application" | "external";

export interface NexusCapabilityOwner {
  readonly kind: NexusCapabilityOwnerKind;
  readonly id: string;
}

export interface NexusCapabilityAction {
  readonly id: string;
  readonly label: string;
  readonly kind: NexusCapabilityActionKind;
  readonly route: string | null;
  readonly enabled: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NexusCapabilityDependency {
  readonly capabilityId: NexusCapabilityId;
  readonly required: boolean;
  readonly reason: string;
}

export interface NexusCapabilityPermission {
  readonly id: string;
  readonly label: string;
  readonly source: NexusPermissionSource;
  readonly required: boolean;
}

export interface NexusSearchableMetadata {
  readonly summary: string;
  readonly terms: readonly string[];
  readonly aliases: readonly string[];
}

export interface NexusCapabilityDefinition {
  readonly id: NexusCapabilityId;
  readonly owner: NexusCapabilityOwner;
  readonly owningNodeId: NexusNodeId | null;
  readonly label: string;
  readonly category: string;
  readonly status: NexusCapabilityStatus;
  readonly actions: readonly NexusCapabilityAction[];
  readonly dependencies: readonly NexusCapabilityDependency[];
  readonly permissions: readonly NexusCapabilityPermission[];
  readonly searchable: NexusSearchableMetadata;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface NexusCapabilityGraphEdge {
  readonly fromCapabilityId: NexusCapabilityId;
  readonly toCapabilityId: NexusCapabilityId;
  readonly required: boolean;
  readonly reason: string;
}

export interface NexusUnresolvedCapabilityDependency {
  readonly fromCapabilityId: NexusCapabilityId;
  readonly missingCapabilityId: NexusCapabilityId;
  readonly required: boolean;
  readonly reason: string;
}

export interface NexusCapabilityGraphSnapshot {
  readonly capabilities: readonly NexusCapabilityDefinition[];
  readonly edges: readonly NexusCapabilityGraphEdge[];
  readonly unresolvedDependencies: readonly NexusUnresolvedCapabilityDependency[];
}
