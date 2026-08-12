import test from "node:test";
import assert from "node:assert/strict";

import type { NexysApplicationBoundary } from "../apps/types";
import { NEXYS_ROOT_APPLICATIONS } from "../apps/rootApplications";
import { nexysCapabilityRegistry } from "../capabilities/centralCapabilityRegistry";
import { NexysCapabilityRegistry } from "../capabilities/NexysCapabilityRegistry";
import type { NexysCapabilityDefinition } from "../capabilities/types";
import {
  NEXYS_COMMUNICATION_MODE_IDS,
  PERSISTENT_COMMUNICATION_CAPABILITIES,
  PERSISTENT_COMMUNICATION_LAYER_ID,
  PERSISTENT_COMMUNICATION_MANIFEST,
} from "../communication/persistentCommunication";
import { NEXYS_DOCK_CONTROLS, NEXYS_DOCK_CONTROL_IDS } from "../dock/nexysDock";
import { NexysConstellationEngine } from "../graph/NexysConstellationEngine";
import {
  NEXYS_ROOT_CONNECTIONS,
  NEXYS_ROOT_NODES,
  routeForNexysNode,
} from "../graph/rootConstellation";
import type { NexysVisualMetadata } from "../graph/types";
import { NexysManifestRegistry } from "../manifests/NexysManifestRegistry";
import {
  NEXYS_ROOT_MANIFESTS,
  NEXYS_ROOT_NODE_IDS,
  isNexysRootNodeId,
  nexysRootManifestRegistry,
} from "../manifests/rootManifests";
import type { NexysNodeManifest } from "../manifests/types";

test("root node manifests cover the seven shared Nexys domains without legacy roots", () => {
  assert.deepEqual(
    NEXYS_ROOT_MANIFESTS.map((manifest) => manifest.id),
    [...NEXYS_ROOT_NODE_IDS],
  );
  assert.deepEqual([...NEXYS_ROOT_NODE_IDS], [
    "identity",
    "memory",
    "knowledge",
    "apps",
    "desk",
    "settings",
    "portal",
  ]);
  assert.equal(NEXYS_ROOT_MANIFESTS.length, 7);
  assert.equal(isNexysRootNodeId("create"), false);
  for (const legacyId of ["workspaces", "projects", "tools", "connect"]) {
    assert.equal(isNexysRootNodeId(legacyId), false);
  }

  for (const manifest of NEXYS_ROOT_MANIFESTS) {
    assert.equal(manifest.kind, "root");
    assert.equal(manifest.parentId, null);
    assert.equal(manifest.application.basePath, `/nexys/${manifest.id}`);
    assert.equal(manifest.application.stateNamespace, `nexys.${manifest.id}`);
    assert.equal(manifest.application.ownsState, true);
    assert.ok(manifest.application.consumes.includes("zar-core"));
    assert.ok(manifest.capabilities.length > 0);

    for (const capability of manifest.capabilities) {
      assert.deepEqual(capability.owner, { kind: "node", id: manifest.id });
      assert.equal(capability.owningNodeId, manifest.id);
      assert.ok(capability.actions.length > 0);
      assert.ok(capability.permissions.some((permission) => permission.id === "kernel.authenticated"));
      assert.ok(capability.searchable.terms.length > 0);
    }
  }
});

test("Create is absent from navigation graph, root application discovery, and root routes", () => {
  const engine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const snapshot = engine.snapshot(engine.createInitialState());

  assert.equal(snapshot.rootNodes.length, 7);
  assert.equal(engine.getNode("create"), null);
  assert.equal(snapshot.connections.some((connection) => connection.sourceId === "create" || connection.targetId === "create"), false);
  assert.equal(NEXYS_ROOT_APPLICATIONS.some((app) => app.nodeId === "create"), false);
  assert.equal(NEXYS_ROOT_APPLICATIONS.some((app) => app.basePath === "/nexys/create"), false);
  assert.equal(routeForNexysNode("create"), "/nexys");
});

test("manifest registry discovers seven navigation nodes and node-owned capabilities", () => {
  const registry = new NexysManifestRegistry(NEXYS_ROOT_MANIFESTS);
  const navigationNodes = registry.toNavigationNodes(testVisualMetadata);
  const identityNode = navigationNodes.find((node) => node.id === "identity");
  const identityCapability = registry.capabilities().get("identity.current-principal");

  assert.equal(navigationNodes.length, 7);
  assert.equal(identityNode?.metadata.route, "/nexys/identity");
  assert.equal(identityNode?.metadata.stateNamespace, "nexys.identity");
  assert.equal(identityNode?.metadata.consumesZarCore, true);
  assert.equal(identityCapability?.owningNodeId, "identity");
  assert.equal(registry.capabilitiesForNode("identity").some((capability) => capability.id === "identity.current-principal"), true);
  assert.equal(registry.capabilitiesForNode("create").length, 0);
});

test("persistent communication layer retains ZAR's internal communication channels", () => {
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.id, PERSISTENT_COMMUNICATION_LAYER_ID);
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.metadata.navigationalNode, false);
  assert.deepEqual(
    PERSISTENT_COMMUNICATION_MANIFEST.modes.map((mode) => mode.id),
    [...NEXYS_COMMUNICATION_MODE_IDS],
  );
  assert.deepEqual(
    PERSISTENT_COMMUNICATION_MANIFEST.modes.map((mode) => mode.label),
    ["Text", "Talk", "Chat", "Image", "Doc", "Upload"],
  );
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.modes.every((mode) => mode.surfacePath !== "/nexys/create"), true);
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.capabilities.length, 6);
});

test("NEXYS dock exposes exactly the approved five controls in order", () => {
  assert.deepEqual(NEXYS_DOCK_CONTROLS.map((control) => control.id), [...NEXYS_DOCK_CONTROL_IDS]);
  assert.deepEqual(
    NEXYS_DOCK_CONTROLS.map((control) => control.label),
    ["Chat", "Upload", "Ideas", "Task", "Search"],
  );
  assert.equal(NEXYS_DOCK_CONTROLS.length, 5);
  assert.equal(NEXYS_DOCK_CONTROLS.some((control) => control.label === "History"), false);
  assert.equal(NEXYS_DOCK_CONTROLS.some((control) => ["Image", "Document", "Doc"].includes(control.label)), false);
  assert.equal(NEXYS_DOCK_CONTROLS.find((control) => control.id === "ideas")?.route, "/desk/ideas");
  assert.equal(NEXYS_DOCK_CONTROLS.find((control) => control.id === "task")?.route, "/desk/task");
  assert.equal(NEXYS_DOCK_CONTROLS.find((control) => control.id === "search")?.route, null);
});

test("creation capabilities remain discoverable but independent of root navigation", () => {
  const communicationCapabilities = nexysCapabilityRegistry.byCommunicationLayer(PERSISTENT_COMMUNICATION_LAYER_ID);
  const createText = nexysCapabilityRegistry.get("create.text");

  assert.equal(communicationCapabilities.length, 6);
  assert.equal(createText?.owner.kind, "communication-layer");
  assert.equal(createText?.owningNodeId, null);
  assert.equal(nexysCapabilityRegistry.byOwner("create").length, 0);
  assert.equal(nexysCapabilityRegistry.search("dictation").some((capability) => capability.id === "create.talk"), true);
  assert.equal(nexysCapabilityRegistry.search("document").some((capability) => capability.id === "create.document"), true);
  assert.equal(NEXYS_ROOT_NODES.some((node) => node.id === PERSISTENT_COMMUNICATION_LAYER_ID), false);
});

test("capability graph remains separate from the navigation graph", () => {
  const capabilityGraph = nexysCapabilityRegistry.graphSnapshot();
  const navigationEngine = new NexysConstellationEngine(NEXYS_ROOT_NODES, NEXYS_ROOT_CONNECTIONS);
  const state = navigationEngine.activateNode(navigationEngine.createInitialState(), "settings");
  const navigationSnapshot = navigationEngine.snapshot(state);
  const capabilityGraphAfterNavigation = nexysCapabilityRegistry.graphSnapshot();

  assert.ok(capabilityGraph.edges.length > 0);
  assert.ok(navigationSnapshot.connections.every((connection) => connection.id.startsWith("root-orbit:")));
  assert.ok(capabilityGraph.edges.every((edge) => edge.fromCapabilityId.includes(".")));
  assert.deepEqual(capabilityGraphAfterNavigation, capabilityGraph);
});

test("duplicate node and capability identifiers are rejected", () => {
  assert.throws(
    () => new NexysManifestRegistry([NEXYS_ROOT_MANIFESTS[0], NEXYS_ROOT_MANIFESTS[0]]),
    /node manifest already registered/,
  );

  const duplicateCapability = nodeCapability("extension", "identity.current-principal");
  assert.throws(
    () => new NexysManifestRegistry([NEXYS_ROOT_MANIFESTS[0], extensionManifest("extension", null, [duplicateCapability])]),
    /capability already registered/,
  );

  const existingCapability = PERSISTENT_COMMUNICATION_CAPABILITIES[0];
  assert.throws(
    () => new NexysCapabilityRegistry([existingCapability, existingCapability]),
    /capability already registered/,
  );
});

test("unknown capability dependencies are retained as unresolved graph metadata", () => {
  const registry = new NexysCapabilityRegistry([
    nodeCapability("extension", "extension.experimental", ["missing.capability"]),
  ]);
  const graph = registry.graphSnapshot();

  assert.equal(graph.capabilities.length, 1);
  assert.equal(graph.edges.length, 0);
  assert.equal(graph.unresolvedDependencies.length, 1);
  assert.equal(graph.unresolvedDependencies[0].missingCapabilityId, "missing.capability");
  assert.equal(registry.get("extension.experimental")?.id, "extension.experimental");
});

test("new node manifests and communication modes can extend without modifying the constellation engine", () => {
  const extraManifest = extensionManifest("identity-insights", "identity", [
    nodeCapability("identity-insights", "identity-insights.review", ["identity.current-principal"]),
  ]);
  const registry = new NexysManifestRegistry([NEXYS_ROOT_MANIFESTS[0], extraManifest]);
  const engine = new NexysConstellationEngine(registry.toNavigationNodes(testVisualMetadata));

  const futureCommunicationCapability = communicationCapability("create.video");
  const capabilityRegistry = new NexysCapabilityRegistry([
    ...nexysCapabilityRegistry.all(),
    futureCommunicationCapability,
  ]);

  assert.equal(engine.getNode("identity-insights")?.parentId, "identity");
  assert.equal(engine.childrenOf("identity").some((node) => node.id === "identity-insights"), true);
  assert.equal(capabilityRegistry.get("create.video")?.owner.id, PERSISTENT_COMMUNICATION_LAYER_ID);
  assert.equal(capabilityRegistry.byCommunicationLayer(PERSISTENT_COMMUNICATION_LAYER_ID).some((capability) => capability.id === "create.video"), true);
  assert.equal(engine.getNode(PERSISTENT_COMMUNICATION_LAYER_ID), null);
});

function testVisualMetadata(manifest: NexysNodeManifest, index: number): NexysVisualMetadata {
  return {
    color: manifest.visual.color,
    icon: manifest.visual.icon,
    orbit: manifest.visual.orbit,
    angle: index,
    coordinates2d: { x: index, y: index },
    coordinates3d: { x: index, y: index, z: 0 },
  };
}

function extensionManifest(
  id: string,
  parentId: string | null,
  capabilities: readonly NexysCapabilityDefinition[],
): NexysNodeManifest {
  return {
    id,
    label: "Extension",
    kind: parentId ? "branch" : "root",
    parentId,
    application: application(id),
    discovery: {
      summary: "Test extension manifest.",
      tags: ["extension"],
      searchableTerms: ["extension"],
    },
    visual: {
      icon: "Sparkles",
      color: "#ffffff",
      orbit: 2,
    },
    capabilities,
    metadata: {},
  };
}

function application(nodeId: string): NexysApplicationBoundary {
  return {
    id: `${nodeId}-application`,
    nodeId,
    label: "Extension",
    basePath: `/nexys/${nodeId}`,
    routePattern: `/nexys/${nodeId}/:view?`,
    stateNamespace: `nexys.${nodeId}`,
    ownsState: true,
    status: "scaffolded",
    consumes: ["zar-core"],
    currentSurfacePath: null,
    notes: ["Test extension boundary."],
  };
}

function nodeCapability(
  owningNodeId: string,
  id: string,
  dependencies: readonly string[] = [],
): NexysCapabilityDefinition {
  return {
    id,
    owner: {
      kind: "node",
      id: owningNodeId,
    },
    owningNodeId,
    label: "Extension Capability",
    category: "extension",
    status: "scaffolded",
    actions: [
      {
        id: `${id}.primary`,
        label: "Open",
        kind: "navigate",
        route: `/nexys/${owningNodeId}`,
        enabled: true,
      },
    ],
    dependencies: dependencies.map((capabilityId) => ({
      capabilityId,
      required: true,
      reason: "Test dependency.",
    })),
    permissions: [
      {
        id: "kernel.authenticated",
        label: "Authenticated user",
        source: "kernel",
        required: true,
      },
    ],
    searchable: {
      summary: "Test capability.",
      terms: ["extension"],
      aliases: [],
    },
    metadata: {},
  };
}

function communicationCapability(id: string): NexysCapabilityDefinition {
  return {
    id,
    owner: {
      kind: "communication-layer",
      id: PERSISTENT_COMMUNICATION_LAYER_ID,
    },
    owningNodeId: null,
    label: "Future Communication Capability",
    category: "communication",
    status: "planned",
    actions: [
      {
        id: `${id}.primary`,
        label: "Open",
        kind: "write",
        route: null,
        enabled: false,
      },
    ],
    dependencies: [],
    permissions: [
      {
        id: "kernel.authenticated",
        label: "Authenticated user",
        source: "kernel",
        required: true,
      },
    ],
    searchable: {
      summary: "Future communication mode.",
      terms: ["communication"],
      aliases: [],
    },
    metadata: {},
  };
}
