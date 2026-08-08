import test from "node:test";
import assert from "node:assert/strict";

import { nexysCapabilityRegistry } from "../capabilities/centralCapabilityRegistry";
import { isNexysCapabilityActionAvailable } from "../capabilities/capabilityAvailability";
import { NexysCapabilityRegistry } from "../capabilities/NexysCapabilityRegistry";
import type { NexysCapabilityDefinition } from "../capabilities/types";
import {
  NEXYS_COMMUNICATION_MODE_IDS,
  PERSISTENT_COMMUNICATION_MANIFEST,
} from "../communication/persistentCommunication";
import {
  extractNexysClientActions,
  parseNexysClientActions,
  resolveDeterministicNexysClientAction,
  resolveNexysClientAction,
} from "../actions/NexysClientActions";
import { NexysConstellationEngine } from "../graph/NexysConstellationEngine";
import {
  NEXYS_ROOT_CONNECTIONS,
  NEXYS_ROOT_NODES,
  routeForNexysNode,
} from "../graph/rootConstellation";
import {
  NEXYS_ROOT_MANIFESTS,
  NEXYS_ROOT_NODE_IDS,
} from "../manifests/rootManifests";
import {
  clearNexysViewportFocus,
  communicationModeViews,
  createFocusedNodeView,
  createNexysViewportState,
  focusNexysViewportNode,
  getAdjacentNexysNode,
  getNexysViewportSnapshot,
  resolveNexysNavigationIntent,
  shouldShowNexysDeveloperInspector,
  userFacingTextForNodeView,
} from "../viewport/NexysViewportModel";

test("Nexys home viewport derives root nodes from the manifest-backed graph", () => {
  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const viewport = createNexysViewportState(graph.activeNode?.id ?? null);
  const viewportSnapshot = getNexysViewportSnapshot(graph, viewport);

  assert.deepEqual(
    graph.rootNodes.map((node) => node.id),
    NEXYS_ROOT_MANIFESTS.map((manifest) => manifest.id),
  );
  assert.equal(graph.rootNodes.length, 8);
  assert.equal(viewportSnapshot.focusedNode?.id, NEXYS_ROOT_NODE_IDS[0]);
  assert.ok(viewportSnapshot.visibleNodes.every((entry) => graph.rootNodes.some((node) => node.id === entry.node.id)));
});

test("Nexys home viewport shows a subset and never restores Create as a root node", () => {
  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const viewportSnapshot = getNexysViewportSnapshot(graph, createNexysViewportState("identity"));
  const visibleIds = viewportSnapshot.visibleNodes.map((entry) => entry.node.id);

  assert.ok(viewportSnapshot.visibleNodes.length < graph.rootNodes.length);
  assert.equal(visibleIds.includes("create"), false);
  assert.equal(graph.rootNodes.some((node) => node.id === "create"), false);
  assert.equal(viewportSnapshot.hiddenNodeCount, graph.rootNodes.length - viewportSnapshot.visibleNodes.length);
});

test("visible nodes update when focus changes", () => {
  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const identityVisible = getNexysViewportSnapshot(graph, createNexysViewportState("identity"))
    .visibleNodes.map((entry) => entry.node.id);
  const projectsVisible = getNexysViewportSnapshot(graph, createNexysViewportState("projects"))
    .visibleNodes.map((entry) => entry.node.id);

  assert.notDeepEqual(identityVisible, projectsVisible);
  assert.equal(projectsVisible[0], "projects");
  assert.ok(projectsVisible.includes("tools"));
});

test("touch or programmatic focus can select a node without changing route data", () => {
  const initial = createNexysViewportState("identity");
  const focused = focusNexysViewportNode(initial, "memory", "touch");

  assert.equal(Object.isFrozen(focused), true);
  assert.equal(focused.focusedNodeId, "memory");
  assert.equal(focused.previousNodeId, "identity");
  assert.equal(focused.navigationSource, "touch");
  assert.equal(routeForNexysNode("memory"), "/nexys/memory");
});

test("ZAR-triggered navigation resolves through nodes and capabilities", () => {
  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const memory = resolveNexysNavigationIntent(
    { kind: "query", query: "Open Memory" },
    graph,
    nexysCapabilityRegistry,
    PERSISTENT_COMMUNICATION_MANIFEST,
  );
  const createText = resolveNexysNavigationIntent(
    { kind: "query", query: "create text" },
    graph,
    nexysCapabilityRegistry,
    PERSISTENT_COMMUNICATION_MANIFEST,
  );

  assert.equal(memory?.kind, "node");
  assert.equal(memory?.nodeId, "memory");
  assert.equal(memory?.route, "/nexys/memory");
  assert.equal(createText?.kind, "communication");
  assert.equal(createText?.route, "/chat");
});

test("focused-node routes and adjacent focus use the existing graph order", () => {
  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const next = getAdjacentNexysNode(graph, "identity", "next");
  const previous = getAdjacentNexysNode(graph, "identity", "previous");

  assert.equal(next?.id, "memory");
  assert.equal(previous?.id, "settings");
  assert.equal(routeForNexysNode(next?.id ?? ""), "/nexys/memory");
  assert.equal(routeForNexysNode("unknown"), "/nexys");
});

test("persistent communication modes are derived from the communication manifest", () => {
  const modes = communicationModeViews(PERSISTENT_COMMUNICATION_MANIFEST);

  assert.deepEqual(modes.map((mode) => mode.id), [...NEXYS_COMMUNICATION_MODE_IDS]);
  assert.deepEqual(modes.map((mode) => mode.label), ["Text", "Talk", "Image", "Draw", "Doc", "Upload"]);
  assert.equal(modes.some((mode) => mode.id === "draw" && mode.enabled), true);
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.route, "/chat");
});

test("normal focused-node presentation excludes developer metadata", () => {
  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState("identity"));
  const focusedNode = graph.activeNode;
  assert.ok(focusedNode);
  const view = createFocusedNodeView(focusedNode, nexysCapabilityRegistry);
  const visibleText = userFacingTextForNodeView(view).join(" ");

  for (const forbidden of [
    "Root Graph",
    "root count",
    "link count",
    "expanded count",
    "trail count",
    "Scaffolded",
    "route value",
    "state namespace",
    "Boundary Contract",
    "ZAR Core consumer",
  ]) {
    assert.equal(visibleText.includes(forbidden), false, `unexpected developer text: ${forbidden}`);
  }
});

test("developer inspector is separate and development-gated", () => {
  assert.equal(shouldShowNexysDeveloperInspector({ isDevelopment: true, queryString: "?debug=nexys" }), true);
  assert.equal(shouldShowNexysDeveloperInspector({ isDevelopment: true, queryString: "?debug=other" }), false);
  assert.equal(shouldShowNexysDeveloperInspector({ isDevelopment: false, queryString: "?debug=nexys" }), false);
});

test("direct Nexys routes and chat communication route remain stable", () => {
  assert.equal(routeForNexysNode("identity"), "/nexys/identity");
  assert.equal(routeForNexysNode("settings"), "/nexys/settings");
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.route, "/chat");
});

test("exact deterministic navigation is narrow and does not intercept substantive prompts", () => {
  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());

  const exact = resolveDeterministicNexysClientAction(
    "Open Memory",
    graph,
    nexysCapabilityRegistry,
    PERSISTENT_COMMUNICATION_MANIFEST,
  );
  const substantive = resolveDeterministicNexysClientAction(
    "Take me to Memory and show me what you retained from yesterday.",
    graph,
    nexysCapabilityRegistry,
    PERSISTENT_COMMUNICATION_MANIFEST,
  );

  assert.deepEqual(exact, { type: "focus-node", nodeId: "memory" });
  assert.equal(substantive, null);
});

test("typed Nexys client actions validate and resolve against Nexys authorities", () => {
  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const actions = extractNexysClientActions({
    reply: "Opening Memory.",
    metadata: {
      nexysClientActions: [
        { type: "focus-node", nodeId: "memory" },
        { type: "navigate-route", route: "https://example.test" },
        { type: "open-capability", capabilityId: "connect.channels" },
      ],
    },
  });

  assert.equal(actions.length, 3);
  assert.equal(Object.isFrozen(actions), true);

  const focus = resolveNexysClientAction(actions[0], graph, nexysCapabilityRegistry, PERSISTENT_COMMUNICATION_MANIFEST);
  const externalRoute = resolveNexysClientAction(actions[1], graph, nexysCapabilityRegistry, PERSISTENT_COMMUNICATION_MANIFEST);
  const scaffoldedCapability = resolveNexysClientAction(actions[2], graph, nexysCapabilityRegistry, PERSISTENT_COMMUNICATION_MANIFEST);

  assert.equal(focus.accepted, true);
  assert.equal(focus.resolution?.route, "/nexys/memory");
  assert.equal(externalRoute.accepted, false);
  assert.equal(externalRoute.reasonCode, "unsafe_route");
  assert.equal(scaffoldedCapability.accepted, false);
  assert.equal(scaffoldedCapability.reasonCode, "capability_unavailable");
});

test("capability status controls user-facing focused-node actions", () => {
  const channels = nexysCapabilityRegistry.get("connect.channels");
  const projectNavigation = nexysCapabilityRegistry.get("projects.navigation");
  assert.ok(channels);
  assert.ok(projectNavigation);

  assert.equal(isNexysCapabilityActionAvailable(channels), false);
  assert.equal(isNexysCapabilityActionAvailable(projectNavigation), true);

  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState("connect"));
  const view = createFocusedNodeView(graph.activeNode!, nexysCapabilityRegistry);

  assert.equal(view.actions.some((action) => action.label === "Connection Channels"), false);
  assert.equal(view.actions.some((action) => action.label === "Provider Accounts"), true);
});

test("invalid action payloads are ignored during parsing", () => {
  const parsed = parseNexysClientActions([
    { type: "focus-node", nodeId: "identity" },
    { type: "focus-node" },
    { type: "navigate-route", route: "/nexys/projects" },
    { type: "navigate-route", route: 1 },
    { type: "unknown", nodeId: "memory" },
  ]);

  assert.deepEqual(parsed, [
    { type: "focus-node", nodeId: "identity" },
    { type: "navigate-route", route: "/nexys/projects" },
  ]);
});

test("returning to Home clears visual focus without touching the graph engine's active node", () => {
  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const focused = focusNexysViewportNode(createNexysViewportState(null), "memory", "touch");
  assert.equal(getNexysViewportSnapshot(graph, focused).focusedNode?.id, "memory");

  const cleared = clearNexysViewportFocus(focused, "route");
  assert.equal(cleared.focusedNodeId, null);
  assert.equal(
    getNexysViewportSnapshot(graph, cleared).focusedNode,
    null,
    "Home must resolve to no focused node at all - no fallback to the first root node or the last active one",
  );
  assert.equal(Object.isFrozen(cleared), true);
});

test("clearing an already-clear focus is a no-op", () => {
  const initial = createNexysViewportState(null);
  assert.equal(clearNexysViewportFocus(initial, "route"), initial);
});

test("Hub Model: no arbitrary truncation - every valid gateway action is exposed", () => {
  const node = NEXYS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexysCapabilityRegistry([
    hubCapability("identity", "alpha", "Alpha Action", "/learning"),
    hubCapability("identity", "beta", "Beta Action", "/projects"),
    hubCapability("identity", "gamma", "Gamma Action", "/workspace"),
    hubCapability("identity", "delta", "Delta Action", "/flows"),
  ]);

  const view = createFocusedNodeView(node, registry);

  assert.deepEqual(
    view.actions.map((a) => a.label),
    ["Alpha Action", "Beta Action", "Gamma Action", "Delta Action"],
    "all four actions must appear - Hub Model must not cap at three",
  );
});

test("Hub Model: ordering is deterministic via displayOrder, not incidental registration order", () => {
  const node = NEXYS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexysCapabilityRegistry([
    hubCapability("identity", "alpha", "Alpha Action", "/learning", { displayOrder: 2 }),
    hubCapability("identity", "beta", "Beta Action", "/projects", { displayOrder: 1 }),
    hubCapability("identity", "gamma", "Gamma Action", "/workspace"),
  ]);

  const view = createFocusedNodeView(node, registry);

  assert.deepEqual(view.actions.map((a) => a.label), ["Beta Action", "Alpha Action", "Gamma Action"]);
});

test("Hub Model: duplicate routes are deduplicated, not shown twice", () => {
  const node = NEXYS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexysCapabilityRegistry([
    hubCapability("identity", "alpha", "Alpha Action", "/learning"),
    hubCapability("identity", "beta", "Beta Action (same destination)", "/learning"),
  ]);

  const view = createFocusedNodeView(node, registry);

  assert.equal(view.actions.length, 1);
  assert.equal(view.actions[0].label, "Alpha Action", "first (highest-priority) occurrence wins");
});

test("Hub Model: route-less actions never appear, even if flagged enabled", () => {
  const node = NEXYS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexysCapabilityRegistry([
    hubCapability("identity", "alpha", "Alpha Action", null),
  ]);

  const view = createFocusedNodeView(node, registry);

  assert.equal(view.actions.length, 0, "an action with no route is not real - it must not appear as interactive");
});

test("Hub Model: hiddenFromHub actions are omitted, and primary is only set when explicitly supported", () => {
  const node = NEXYS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexysCapabilityRegistry([
    hubCapability("identity", "alpha", "Alpha Action", "/learning"),
    hubCapability("identity", "beta", "Beta Action", "/projects", { hiddenFromHub: true }),
    hubCapability("identity", "gamma", "Gamma Action", "/workspace", { primary: true }),
  ]);

  const view = createFocusedNodeView(node, registry);

  assert.deepEqual(view.actions.map((a) => a.label), ["Alpha Action", "Gamma Action"]);
  assert.equal(view.primaryAction?.label, "Gamma Action");
  assert.equal(view.actions.find((a) => a.label === "Alpha Action")?.primary, false);
});

test("Hub Model: primaryAction is null when nothing explicitly opts in - never defaults to the first action", () => {
  const node = NEXYS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexysCapabilityRegistry([
    hubCapability("identity", "alpha", "Alpha Action", "/learning"),
    hubCapability("identity", "beta", "Beta Action", "/projects"),
  ]);

  const view = createFocusedNodeView(node, registry);

  assert.equal(view.primaryAction, null);
});

function hubCapability(
  owningNodeId: string,
  name: string,
  label: string,
  route: string | null,
  actionMetadata?: { readonly displayOrder?: number; readonly primary?: boolean; readonly hiddenFromHub?: boolean },
): NexysCapabilityDefinition {
  const id = `${owningNodeId}.hub-test-${name}`;
  return {
    id,
    owner: { kind: "node", id: owningNodeId },
    owningNodeId,
    label,
    category: owningNodeId,
    status: "available",
    actions: [
      {
        id: `${id}.primary`,
        label,
        kind: "navigate",
        route,
        enabled: true,
        metadata: actionMetadata,
      },
    ],
    dependencies: [],
    permissions: [{ id: "kernel.authenticated", label: "Authenticated user", source: "kernel", required: true }],
    searchable: { summary: `${label} summary`, terms: [name], aliases: [] },
    metadata: {},
  };
}
