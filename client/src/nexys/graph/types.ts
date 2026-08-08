export type NexysNodeId = string;
export type NexysApplicationId = string;

export type NexysNodeKind = "root" | "branch" | "leaf";
export type NexysConnectionKind = "parent" | "orbit" | "semantic" | "navigation";

export interface NexysCoordinate2D {
  readonly x: number;
  readonly y: number;
}

export interface NexysCoordinate3D extends NexysCoordinate2D {
  readonly z: number;
}

export interface NexysVisualMetadata {
  readonly color: string;
  readonly icon: string;
  readonly orbit: number;
  readonly angle: number;
  readonly coordinates2d: NexysCoordinate2D;
  readonly coordinates3d: NexysCoordinate3D;
}

export interface NexysNodeMetadata {
  readonly title: string;
  readonly summary: string;
  readonly applicationId: NexysApplicationId;
  readonly route: string;
  readonly stateNamespace: string;
  readonly ownsState: true;
  readonly consumesZarCore: boolean;
  readonly coreCapabilities: readonly string[];
  readonly tags: readonly string[];
  readonly visual: NexysVisualMetadata;
}

export interface NexysNodeDefinition {
  readonly id: NexysNodeId;
  readonly label: string;
  readonly kind: NexysNodeKind;
  readonly parentId: NexysNodeId | null;
  readonly metadata: NexysNodeMetadata;
  readonly defaultExpanded?: boolean;
}

export interface NexysConnectionDefinition {
  readonly id: string;
  readonly sourceId: NexysNodeId;
  readonly targetId: NexysNodeId;
  readonly kind: NexysConnectionKind;
  readonly label?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NexysGraphState {
  readonly activeNodeId: NexysNodeId | null;
  readonly expandedNodeIds: readonly NexysNodeId[];
  readonly navigationTrail: readonly NexysNodeId[];
  readonly visitedNodeIds: readonly NexysNodeId[];
}

export interface NexysGraphSnapshot {
  readonly nodes: readonly NexysNodeDefinition[];
  readonly rootNodes: readonly NexysNodeDefinition[];
  readonly connections: readonly NexysConnectionDefinition[];
  readonly activeNode: NexysNodeDefinition | null;
  readonly activePath: readonly NexysNodeDefinition[];
  readonly expandedNodeIds: readonly NexysNodeId[];
  readonly navigationTrail: readonly NexysNodeId[];
}
