export type NexusNodeId = string;
export type NexusApplicationId = string;

export type NexusNodeKind = "root" | "branch" | "leaf";
export type NexusConnectionKind = "parent" | "orbit" | "semantic" | "navigation";

export interface NexusCoordinate2D {
  readonly x: number;
  readonly y: number;
}

export interface NexusCoordinate3D extends NexusCoordinate2D {
  readonly z: number;
}

export interface NexusVisualMetadata {
  readonly color: string;
  readonly icon: string;
  readonly orbit: number;
  readonly angle: number;
  readonly coordinates2d: NexusCoordinate2D;
  readonly coordinates3d: NexusCoordinate3D;
}

export interface NexusNodeMetadata {
  readonly title: string;
  readonly summary: string;
  readonly applicationId: NexusApplicationId;
  readonly route: string;
  readonly stateNamespace: string;
  readonly ownsState: true;
  readonly consumesZarCore: boolean;
  readonly coreCapabilities: readonly string[];
  readonly tags: readonly string[];
  readonly visual: NexusVisualMetadata;
}

export interface NexusNodeDefinition {
  readonly id: NexusNodeId;
  readonly label: string;
  readonly kind: NexusNodeKind;
  readonly parentId: NexusNodeId | null;
  readonly metadata: NexusNodeMetadata;
  readonly defaultExpanded?: boolean;
}

export interface NexusConnectionDefinition {
  readonly id: string;
  readonly sourceId: NexusNodeId;
  readonly targetId: NexusNodeId;
  readonly kind: NexusConnectionKind;
  readonly label?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NexusGraphState {
  readonly activeNodeId: NexusNodeId | null;
  readonly expandedNodeIds: readonly NexusNodeId[];
  readonly navigationTrail: readonly NexusNodeId[];
  readonly visitedNodeIds: readonly NexusNodeId[];
}

export interface NexusGraphSnapshot {
  readonly nodes: readonly NexusNodeDefinition[];
  readonly rootNodes: readonly NexusNodeDefinition[];
  readonly connections: readonly NexusConnectionDefinition[];
  readonly activeNode: NexusNodeDefinition | null;
  readonly activePath: readonly NexusNodeDefinition[];
  readonly expandedNodeIds: readonly NexusNodeId[];
  readonly navigationTrail: readonly NexusNodeId[];
}
