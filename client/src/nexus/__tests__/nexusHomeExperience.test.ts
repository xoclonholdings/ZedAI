import test from "node:test";
import assert from "node:assert/strict";

import { nexusCapabilityRegistry } from "../capabilities/centralCapabilityRegistry";
import { isNexusCapabilityActionAvailable } from "../capabilities/capabilityAvailability";
import { NexusCapabilityRegistry } from "../capabilities/NexusCapabilityRegistry";
import type { NexusCapabilityDefinition } from "../capabilities/types";
import {
  NEXUS_COMMUNICATION_MODE_IDS,
  PERSISTENT_COMMUNICATION_MANIFEST,
} from "../communication/persistentCommunication";
import {
  extractNexusClientActions,
  parseNexusClientActions,
  resolveDeterministicNexusClientAction,
  resolveNexusClientAction,
} from "../actions/NexusClientActions";
import { NexusConstellationEngine } from "../graph/NexusConstellationEngine";
import {
  NEXUS_ROOT_CONNECTIONS,
  NEXUS_ROOT_NODES,
  routeForNexusNode,
} from "../graph/rootConstellation";
import {
  NEXUS_ROOT_MANIFESTS,
  NEXUS_ROOT_NODE_IDS,
} from "../manifests/rootManifests";
import {
  clearNexusViewportFocus,
  communicationModeViews,
  createFocusedNodeView,
  createNexusViewportState,
  focusNexusViewportNode,
  getAdjacentNexusNode,
  getNexusViewportSnapshot,
  resolveNexusNavigationIntent,
  shouldShowNexusDeveloperInspector,
  userFacingTextForNodeView,
} from "../viewport/NexusViewportModel";

test("Nexus home viewport derives root nodes from the manifest-backed graph", () => {
  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const viewport = createNexusViewportState(graph.activeNode?.id ?? null);
  const viewportSnapshot = getNexusViewportSnapshot(graph, viewport);

  assert.deepEqual(
    graph.rootNodes.map((node) => node.id),
    NEXUS_ROOT_MANIFESTS.map((manifest) => manifest.id),
  );
  assert.equal(graph.rootNodes.length, 8);
  assert.equal(viewportSnapshot.focusedNode?.id, NEXUS_ROOT_NODE_IDS[0]);
  assert.ok(viewportSnapshot.visibleNodes.every((entry) => graph.rootNodes.some((node) => node.id === entry.node.id)));
});

test("Nexus home viewport shows a subset and never restores Create as a root node", () => {
  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const viewportSnapshot = getNexusViewportSnapshot(graph, createNexusViewportState("identity"));
  const visibleIds = viewportSnapshot.visibleNodes.map((entry) => entry.node.id);

  assert.ok(viewportSnapshot.visibleNodes.length < graph.rootNodes.length);
  assert.equal(visibleIds.includes("create"), false);
  assert.equal(graph.rootNodes.some((node) => node.id === "create"), false);
  assert.equal(viewportSnapshot.hiddenNodeCount, graph.rootNodes.length - viewportSnapshot.visibleNodes.length);
});

test("visible nodes update when focus changes", () => {
  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const identityVisible = getNexusViewportSnapshot(graph, createNexusViewportState("identity"))
    .visibleNodes.map((entry) => entry.node.id);
  const projectsVisible = getNexusViewportSnapshot(graph, createNexusViewportState("projects"))
    .visibleNodes.map((entry) => entry.node.id);

  assert.notDeepEqual(identityVisible, projectsVisible);
  assert.equal(projectsVisible[0], "projects");
  assert.ok(projectsVisible.includes("tools"));
});

test("touch or programmatic focus can select a node without changing route data", () => {
  const initial = createNexusViewportState("identity");
  const focused = focusNexusViewportNode(initial, "memory", "touch");

  assert.equal(Object.isFrozen(focused), true);
  assert.equal(focused.focusedNodeId, "memory");
  assert.equal(focused.previousNodeId, "identity");
  assert.equal(focused.navigationSource, "touch");
  assert.equal(routeForNexusNode("memory"), "/nexus/memory");
});

test("ZAR-triggered navigation resolves through nodes and capabilities", () => {
  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const memory = resolveNexusNavigationIntent(
    { kind: "query", query: "Open Memory" },
    graph,
    nexusCapabilityRegistry,
    PERSISTENT_COMMUNICATION_MANIFEST,
  );
  const createText = resolveNexusNavigationIntent(
    { kind: "query", query: "create text" },
    graph,
    nexusCapabilityRegistry,
    PERSISTENT_COMMUNICATION_MANIFEST,
  );

  assert.equal(memory?.kind, "node");
  assert.equal(memory?.nodeId, "memory");
  assert.equal(memory?.route, "/nexus/memory");
  assert.equal(createText?.kind, "communication");
  assert.equal(createText?.route, "/chat");
});

test("focused-node routes and adjacent focus use the existing graph order", () => {
  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const next = getAdjacentNexusNode(graph, "identity", "next");
  const previous = getAdjacentNexusNode(graph, "identity", "previous");

  assert.equal(next?.id, "memory");
  assert.equal(previous?.id, "settings");
  assert.equal(routeForNexusNode(next?.id ?? ""), "/nexus/memory");
  assert.equal(routeForNexusNode("unknown"), "/nexus");
});

test("persistent communication modes are derived from the communication manifest", () => {
  const modes = communicationModeViews(PERSISTENT_COMMUNICATION_MANIFEST);

  assert.deepEqual(modes.map((mode) => mode.id), [...NEXUS_COMMUNICATION_MODE_IDS]);
  assert.deepEqual(modes.map((mode) => mode.label), ["Text", "Talk", "Image", "Draw", "Doc", "Upload"]);
  assert.equal(modes.some((mode) => mode.id === "draw" && mode.enabled), false);
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.route, "/chat");
});

test("normal focused-node presentation excludes developer metadata", () => {
  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState("identity"));
  const focusedNode = graph.activeNode;
  assert.ok(focusedNode);
  const view = createFocusedNodeView(focusedNode, nexusCapabilityRegistry);
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
  assert.equal(shouldShowNexusDeveloperInspector({ isDevelopment: true, queryString: "?debug=nexus" }), true);
  assert.equal(shouldShowNexusDeveloperInspector({ isDevelopment: true, queryString: "?debug=other" }), false);
  assert.equal(shouldShowNexusDeveloperInspector({ isDevelopment: false, queryString: "?debug=nexus" }), false);
});

test("direct Nexus routes and chat communication route remain stable", () => {
  assert.equal(routeForNexusNode("identity"), "/nexus/identity");
  assert.equal(routeForNexusNode("settings"), "/nexus/settings");
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.route, "/chat");
});

test("exact deterministic navigation is narrow and does not intercept substantive prompts", () => {
  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());

  const exact = resolveDeterministicNexusClientAction(
    "Open Memory",
    graph,
    nexusCapabilityRegistry,
    PERSISTENT_COMMUNICATION_MANIFEST,
  );
  const substantive = resolveDeterministicNexusClientAction(
    "Take me to Memory and show me what you retained from yesterday.",
    graph,
    nexusCapabilityRegistry,
    PERSISTENT_COMMUNICATION_MANIFEST,
  );

  assert.deepEqual(exact, { type: "focus-node", nodeId: "memory" });
  assert.equal(substantive, null);
});

test("typed Nexus client actions validate and resolve against Nexus authorities", () => {
  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const actions = extractNexusClientActions({
    reply: "Opening Memory.",
    metadata: {
      nexusClientActions: [
        { type: "focus-node", nodeId: "memory" },
        { type: "navigate-route", route: "https://example.test" },
        { type: "open-capability", capabilityId: "connect.provider-accounts" },
      ],
    },
  });

  assert.equal(actions.length, 3);
  assert.equal(Object.isFrozen(actions), true);

  const focus = resolveNexusClientAction(actions[0], graph, nexusCapabilityRegistry, PERSISTENT_COMMUNICATION_MANIFEST);
  const externalRoute = resolveNexusClientAction(actions[1], graph, nexusCapabilityRegistry, PERSISTENT_COMMUNICATION_MANIFEST);
  const scaffoldedCapability = resolveNexusClientAction(actions[2], graph, nexusCapabilityRegistry, PERSISTENT_COMMUNICATION_MANIFEST);

  assert.equal(focus.accepted, true);
  assert.equal(focus.resolution?.route, "/nexus/memory");
  assert.equal(externalRoute.accepted, false);
  assert.equal(externalRoute.reasonCode, "unsafe_route");
  assert.equal(scaffoldedCapability.accepted, false);
  assert.equal(scaffoldedCapability.reasonCode, "capability_unavailable");
});

test("capability status controls user-facing focused-node actions", () => {
  const connect = nexusCapabilityRegistry.get("connect.provider-accounts");
  const projectNavigation = nexusCapabilityRegistry.get("projects.navigation");
  assert.ok(connect);
  assert.ok(projectNavigation);

  assert.equal(isNexusCapabilityActionAvailable(connect), false);
  assert.equal(isNexusCapabilityActionAvailable(projectNavigation), true);

  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState("connect"));
  const view = createFocusedNodeView(graph.activeNode!, nexusCapabilityRegistry);

  assert.equal(view.actions.some((action) => action.label === "Provider Accounts"), false);
});

test("invalid action payloads are ignored during parsing", () => {
  const parsed = parseNexusClientActions([
    { type: "focus-node", nodeId: "identity" },
    { type: "focus-node" },
    { type: "navigate-route", route: "/nexus/projects" },
    { type: "navigate-route", route: 1 },
    { type: "unknown", nodeId: "memory" },
  ]);

  assert.deepEqual(parsed, [
    { type: "focus-node", nodeId: "identity" },
    { type: "navigate-route", route: "/nexus/projects" },
  ]);
});

test("returning to Home clears visual focus without touching the graph engine's active node", () => {
  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const graph = engine.snapshot(engine.createInitialState());
  const focused = focusNexusViewportNode(createNexusViewportState(null), "memory", "touch");
  assert.equal(getNexusViewportSnapshot(graph, focused).focusedNode?.id, "memory");

  const cleared = clearNexusViewportFocus(focused, "route");
  assert.equal(cleared.focusedNodeId, null);
  assert.equal(
    getNexusViewportSnapshot(graph, cleared).focusedNode,
    null,
    "Home must resolve to no focused node at all - no fallback to the first root node or the last active one",
  );
  assert.equal(Object.isFrozen(cleared), true);
});

test("clearing an already-clear focus is a no-op", () => {
  const initial = createNexusViewportState(null);
  assert.equal(clearNexusViewportFocus(initial, "route"), initial);
});

test("Hub Model: no arbitrary truncation - every valid gateway action is exposed", () => {
  const node = NEXUS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexusCapabilityRegistry([
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
  const node = NEXUS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexusCapabilityRegistry([
    hubCapability("identity", "alpha", "Alpha Action", "/learning", { displayOrder: 2 }),
    hubCapability("identity", "beta", "Beta Action", "/projects", { displayOrder: 1 }),
    hubCapability("identity", "gamma", "Gamma Action", "/workspace"),
  ]);

  const view = createFocusedNodeView(node, registry);

  assert.deepEqual(view.actions.map((a) => a.label), ["Beta Action", "Alpha Action", "Gamma Action"]);
});

test("Hub Model: duplicate routes are deduplicated, not shown twice", () => {
  const node = NEXUS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexusCapabilityRegistry([
    hubCapability("identity", "alpha", "Alpha Action", "/learning"),
    hubCapability("identity", "beta", "Beta Action (same destination)", "/learning"),
  ]);

  const view = createFocusedNodeView(node, registry);

  assert.equal(view.actions.length, 1);
  assert.equal(view.actions[0].label, "Alpha Action", "first (highest-priority) occurrence wins");
});

test("Hub Model: route-less actions never appear, even if flagged enabled", () => {
  const node = NEXUS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexusCapabilityRegistry([
    hubCapability("identity", "alpha", "Alpha Action", null),
  ]);

  const view = createFocusedNodeView(node, registry);

  assert.equal(view.actions.length, 0, "an action with no route is not real - it must not appear as interactive");
});

test("Hub Model: hiddenFromHub actions are omitted, and primary is only set when explicitly supported", () => {
  const node = NEXUS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexusCapabilityRegistry([
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
  const node = NEXUS_ROOT_NODES.find((n) => n.id === "identity")!;
  const registry = new NexusCapabilityRegistry([
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
): NexusCapabilityDefinition {
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
