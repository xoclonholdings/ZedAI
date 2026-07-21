import test from "node:test";
import assert from "node:assert/strict";

import { nexusCapabilityRegistry } from "../capabilities/centralCapabilityRegistry";
import { isNexusCapabilityActionAvailable } from "../capabilities/capabilityAvailability";
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
  assert.equal(modes.some((mode) => mode.id === "draw" && mode.enabled), true);
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
