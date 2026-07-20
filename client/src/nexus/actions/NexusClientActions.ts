import type { NexusCapabilityRegistry } from "../capabilities/NexusCapabilityRegistry";
import { isNexusCapabilityActionAvailable } from "../capabilities/capabilityAvailability";
import type { PersistentCommunicationManifest } from "../communication/types";
import type { NexusGraphSnapshot, NexusNodeId } from "../graph/types";
import {
  resolveNexusNavigationIntent,
  type NexusNavigationResolution,
} from "../viewport/NexusViewportModel";

export type NexusClientAction =
  | {
      readonly type: "focus-node";
      readonly nodeId: NexusNodeId;
    }
  | {
      readonly type: "open-capability";
      readonly capabilityId: string;
    }
  | {
      readonly type: "open-communication";
      readonly modeId: string;
      readonly conversationId?: string;
    }
  | {
      readonly type: "navigate-route";
      readonly route: string;
    };

export interface NexusActionExecutionResult {
  readonly accepted: boolean;
  readonly reasonCode: string;
  readonly action: NexusClientAction | null;
  readonly resolution?: NexusNavigationResolution | null;
}

const CLIENT_ACTION_PATHS = [
  ["clientActions"],
  ["nexusClientActions"],
  ["actions"],
  ["metadata", "clientActions"],
  ["metadata", "nexusClientActions"],
  ["metadata", "nexus", "clientActions"],
] as const;

const COMMAND_PREFIXES = [
  "open",
  "go to",
  "show",
  "show me",
  "take me to",
] as const;

export function extractNexusClientActions(response: unknown): readonly NexusClientAction[] {
  const actions: NexusClientAction[] = [];
  const seen = new Set<string>();

  for (const path of CLIENT_ACTION_PATHS) {
    const value = readPath(response, path);
    for (const action of parseNexusClientActions(value)) {
      const key = JSON.stringify(action);
      if (seen.has(key)) continue;
      seen.add(key);
      actions.push(action);
    }
  }

  return deepFreeze(actions) as readonly NexusClientAction[];
}

export function parseNexusClientActions(value: unknown): readonly NexusClientAction[] {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map(parseNexusClientAction)
    .filter((action): action is NexusClientAction => Boolean(action));
  return deepFreeze(parsed) as readonly NexusClientAction[];
}

export function resolveDeterministicNexusClientAction(
  query: string,
  graph: NexusGraphSnapshot,
  capabilityRegistry: NexusCapabilityRegistry,
  communication: PersistentCommunicationManifest,
): NexusClientAction | null {
  const normalized = normalizeCommand(query);
  if (!normalized) return null;

  for (const node of graph.rootNodes) {
    const aliases = [
      node.id,
      node.label,
      node.metadata.title,
      ...node.metadata.tags,
    ].map(normalizeCommand).filter(Boolean);

    for (const alias of aliases) {
      if (matchesExactCommand(normalized, alias)) {
        return deepFreeze({ type: "focus-node", nodeId: node.id }) as NexusClientAction;
      }
    }
  }

  for (const mode of communication.modes) {
    const aliases = [mode.id, mode.label, mode.capabilityId]
      .map(normalizeCommand)
      .filter(Boolean);
    for (const alias of aliases) {
      if (matchesExactCommand(normalized, alias)) {
        return deepFreeze({ type: "open-communication", modeId: mode.id }) as NexusClientAction;
      }
    }
  }

  for (const capability of capabilityRegistry.all()) {
    if (!isNexusCapabilityActionAvailable(capability)) continue;
    const aliases = [
      capability.id,
      capability.label,
      ...capability.searchable.aliases,
    ].map(normalizeCommand).filter(Boolean);
    for (const alias of aliases) {
      if (matchesExactCommand(normalized, alias)) {
        return deepFreeze({ type: "open-capability", capabilityId: capability.id }) as NexusClientAction;
      }
    }
  }

  return null;
}

export function resolveNexusClientAction(
  action: NexusClientAction,
  graph: NexusGraphSnapshot,
  capabilityRegistry: NexusCapabilityRegistry,
  communication: PersistentCommunicationManifest,
): NexusActionExecutionResult {
  switch (action.type) {
    case "focus-node": {
      const resolution = resolveNexusNavigationIntent(
        { kind: "node", nodeId: action.nodeId },
        graph,
        capabilityRegistry,
        communication,
      );
      return resolution?.nodeId
        ? accepted(action, "focus_node", resolution)
        : rejected(action, "unknown_node");
    }

    case "open-capability": {
      const capability = capabilityRegistry.get(action.capabilityId);
      if (!capability) return rejected(action, "unknown_capability");
      if (!isNexusCapabilityActionAvailable(capability)) {
        return rejected(action, "capability_unavailable");
      }
      const resolution = resolveNexusNavigationIntent(
        { kind: "capability", capabilityId: action.capabilityId },
        graph,
        capabilityRegistry,
        communication,
      );
      return resolution ? accepted(action, "open_capability", resolution) : rejected(action, "unresolved_capability");
    }

    case "open-communication": {
      const mode = communication.modes.find((candidate) => candidate.id === action.modeId);
      if (!mode) return rejected(action, "unknown_communication_mode");
      if (mode.status !== "available" || !mode.surfacePath) {
        return rejected(action, "communication_mode_unavailable");
      }
      return accepted(action, "open_communication", {
        kind: "communication",
        nodeId: null,
        route: action.conversationId ? `${mode.surfacePath}/${action.conversationId}` : mode.surfacePath,
        label: mode.label,
        capabilityId: mode.capabilityId,
        source: "communication",
      });
    }

    case "navigate-route":
      return isSafeInternalRoute(action.route)
        ? accepted(action, "navigate_route")
        : rejected(action, "unsafe_route");

    default:
      return rejected(null, "invalid_action");
  }
}

function parseNexusClientAction(value: unknown): NexusClientAction | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = record.type;

  if (type === "focus-node" && typeof record.nodeId === "string") {
    return deepFreeze({ type, nodeId: record.nodeId }) as NexusClientAction;
  }

  if (type === "open-capability" && typeof record.capabilityId === "string") {
    return deepFreeze({ type, capabilityId: record.capabilityId }) as NexusClientAction;
  }

  if (type === "open-communication" && typeof record.modeId === "string") {
    return deepFreeze({
      type,
      modeId: record.modeId,
      ...(typeof record.conversationId === "string" ? { conversationId: record.conversationId } : {}),
    }) as NexusClientAction;
  }

  if (type === "navigate-route" && typeof record.route === "string") {
    return deepFreeze({ type, route: record.route }) as NexusClientAction;
  }

  return null;
}

function accepted(
  action: NexusClientAction,
  reasonCode: string,
  resolution?: NexusNavigationResolution,
): NexusActionExecutionResult {
  return deepFreeze({ accepted: true, reasonCode, action, resolution: resolution ?? null }) as NexusActionExecutionResult;
}

function rejected(
  action: NexusClientAction | null,
  reasonCode: string,
): NexusActionExecutionResult {
  return deepFreeze({ accepted: false, reasonCode, action }) as NexusActionExecutionResult;
}

function matchesExactCommand(normalizedCommand: string, normalizedTarget: string): boolean {
  if (!normalizedTarget) return false;
  if (normalizedCommand === normalizedTarget) return true;
  return COMMAND_PREFIXES.some((prefix) => normalizedCommand === `${prefix} ${normalizedTarget}`);
}

function normalizeCommand(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function isSafeInternalRoute(route: string): boolean {
  return route.startsWith("/") && !route.startsWith("//") && !/[\r\n]/.test(route);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== "object") return value as Readonly<T>;
  const record = value as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(record)) {
    const child = record[key];
    if (child && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}
