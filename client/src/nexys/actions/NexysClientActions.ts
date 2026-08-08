import type { NexysCapabilityRegistry } from "../capabilities/NexysCapabilityRegistry";
import { isNexysCapabilityActionAvailable } from "../capabilities/capabilityAvailability";
import type { PersistentCommunicationManifest } from "../communication/types";
import type { NexysGraphSnapshot, NexysNodeId } from "../graph/types";
import {
  resolveNexysNavigationIntent,
  type NexysNavigationResolution,
} from "../viewport/NexysViewportModel";

export type NexysClientAction =
  | {
      readonly type: "focus-node";
      readonly nodeId: NexysNodeId;
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

export interface NexysActionExecutionResult {
  readonly accepted: boolean;
  readonly reasonCode: string;
  readonly action: NexysClientAction | null;
  readonly resolution?: NexysNavigationResolution | null;
}

const CLIENT_ACTION_PATHS = [
  ["clientActions"],
  ["nexysClientActions"],
  ["actions"],
  ["metadata", "clientActions"],
  ["metadata", "nexysClientActions"],
  ["metadata", "nexys", "clientActions"],
] as const;

const COMMAND_PREFIXES = [
  "open",
  "go to",
  "show",
  "show me",
  "take me to",
] as const;

export function extractNexysClientActions(response: unknown): readonly NexysClientAction[] {
  const actions: NexysClientAction[] = [];
  const seen = new Set<string>();

  for (const path of CLIENT_ACTION_PATHS) {
    const value = readPath(response, path);
    for (const action of parseNexysClientActions(value)) {
      const key = JSON.stringify(action);
      if (seen.has(key)) continue;
      seen.add(key);
      actions.push(action);
    }
  }

  return deepFreeze(actions) as readonly NexysClientAction[];
}

export function parseNexysClientActions(value: unknown): readonly NexysClientAction[] {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map(parseNexysClientAction)
    .filter((action): action is NexysClientAction => Boolean(action));
  return deepFreeze(parsed) as readonly NexysClientAction[];
}

export function resolveDeterministicNexysClientAction(
  query: string,
  graph: NexysGraphSnapshot,
  capabilityRegistry: NexysCapabilityRegistry,
  communication: PersistentCommunicationManifest,
): NexysClientAction | null {
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
        return deepFreeze({ type: "focus-node", nodeId: node.id }) as NexysClientAction;
      }
    }
  }

  for (const mode of communication.modes) {
    const aliases = [mode.id, mode.label, mode.capabilityId]
      .map(normalizeCommand)
      .filter(Boolean);
    for (const alias of aliases) {
      if (matchesExactCommand(normalized, alias)) {
        return deepFreeze({ type: "open-communication", modeId: mode.id }) as NexysClientAction;
      }
    }
  }

  for (const capability of capabilityRegistry.all()) {
    if (!isNexysCapabilityActionAvailable(capability)) continue;
    const aliases = [
      capability.id,
      capability.label,
      ...capability.searchable.aliases,
    ].map(normalizeCommand).filter(Boolean);
    for (const alias of aliases) {
      if (matchesExactCommand(normalized, alias)) {
        return deepFreeze({ type: "open-capability", capabilityId: capability.id }) as NexysClientAction;
      }
    }
  }

  return null;
}

export function resolveNexysClientAction(
  action: NexysClientAction,
  graph: NexysGraphSnapshot,
  capabilityRegistry: NexysCapabilityRegistry,
  communication: PersistentCommunicationManifest,
): NexysActionExecutionResult {
  switch (action.type) {
    case "focus-node": {
      const resolution = resolveNexysNavigationIntent(
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
      if (!isNexysCapabilityActionAvailable(capability)) {
        return rejected(action, "capability_unavailable");
      }
      const resolution = resolveNexysNavigationIntent(
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

function parseNexysClientAction(value: unknown): NexysClientAction | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = record.type;

  if (type === "focus-node" && typeof record.nodeId === "string") {
    return deepFreeze({ type, nodeId: record.nodeId }) as NexysClientAction;
  }

  if (type === "open-capability" && typeof record.capabilityId === "string") {
    return deepFreeze({ type, capabilityId: record.capabilityId }) as NexysClientAction;
  }

  if (type === "open-communication" && typeof record.modeId === "string") {
    return deepFreeze({
      type,
      modeId: record.modeId,
      ...(typeof record.conversationId === "string" ? { conversationId: record.conversationId } : {}),
    }) as NexysClientAction;
  }

  if (type === "navigate-route" && typeof record.route === "string") {
    return deepFreeze({ type, route: record.route }) as NexysClientAction;
  }

  return null;
}

function accepted(
  action: NexysClientAction,
  reasonCode: string,
  resolution?: NexysNavigationResolution,
): NexysActionExecutionResult {
  return deepFreeze({ accepted: true, reasonCode, action, resolution: resolution ?? null }) as NexysActionExecutionResult;
}

function rejected(
  action: NexysClientAction | null,
  reasonCode: string,
): NexysActionExecutionResult {
  return deepFreeze({ accepted: false, reasonCode, action }) as NexysActionExecutionResult;
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
