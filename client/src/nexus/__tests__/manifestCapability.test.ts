import test from "node:test";
import assert from "node:assert/strict";

import type { NexusApplicationBoundary } from "../apps/types";
import { NEXUS_ROOT_APPLICATIONS } from "../apps/rootApplications";
import { nexusCapabilityRegistry } from "../capabilities/centralCapabilityRegistry";
import { NexusCapabilityRegistry } from "../capabilities/NexusCapabilityRegistry";
import type { NexusCapabilityDefinition } from "../capabilities/types";
import {
  NEXUS_COMMUNICATION_MODE_IDS,
  PERSISTENT_COMMUNICATION_CAPABILITIES,
  PERSISTENT_COMMUNICATION_LAYER_ID,
  PERSISTENT_COMMUNICATION_MANIFEST,
} from "../communication/persistentCommunication";
import { NexusConstellationEngine } from "../graph/NexusConstellationEngine";
import {
  NEXUS_ROOT_CONNECTIONS,
  NEXUS_ROOT_NODES,
  routeForNexusNode,
} from "../graph/rootConstellation";
import type { NexusVisualMetadata } from "../graph/types";
import { NexusManifestRegistry } from "../manifests/NexusManifestRegistry";
import {
  NEXUS_ROOT_MANIFESTS,
  NEXUS_ROOT_NODE_IDS,
  isNexusRootNodeId,
  nexusRootManifestRegistry,
} from "../manifests/rootManifests";
import type { NexusNodeManifest } from "../manifests/types";

test("root node manifests cover the eight permanent Nexus roots without Create", () => {
  assert.deepEqual(
    NEXUS_ROOT_MANIFESTS.map((manifest) => manifest.id),
    [...NEXUS_ROOT_NODE_IDS],
  );
  assert.deepEqual([...NEXUS_ROOT_NODE_IDS], [
    "identity",
    "memory",
    "knowledge",
    "workspaces",
    "projects",
    "tools",
    "connect",
    "settings",
  ]);
  assert.equal(NEXUS_ROOT_MANIFESTS.length, 8);
  assert.equal(isNexusRootNodeId("create"), false);

  for (const manifest of NEXUS_ROOT_MANIFESTS) {
    assert.equal(manifest.kind, "root");
    assert.equal(manifest.parentId, null);
    assert.equal(manifest.application.basePath, `/nexus/${manifest.id}`);
    assert.equal(manifest.application.stateNamespace, `nexus.${manifest.id}`);
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
  const engine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const snapshot = engine.snapshot(engine.createInitialState());

  assert.equal(snapshot.rootNodes.length, 8);
  assert.equal(engine.getNode("create"), null);
  assert.equal(snapshot.connections.some((connection) => connection.sourceId === "create" || connection.targetId === "create"), false);
  assert.equal(NEXUS_ROOT_APPLICATIONS.some((app) => app.nodeId === "create"), false);
  assert.equal(NEXUS_ROOT_APPLICATIONS.some((app) => app.basePath === "/nexus/create"), false);
  assert.equal(routeForNexusNode("create"), "/nexus");
});

test("manifest registry discovers eight navigation nodes and node-owned capabilities", () => {
  const registry = new NexusManifestRegistry(NEXUS_ROOT_MANIFESTS);
  const navigationNodes = registry.toNavigationNodes(testVisualMetadata);
  const identityNode = navigationNodes.find((node) => node.id === "identity");
  const identityCapability = registry.capabilities().get("identity.current-principal");

  assert.equal(navigationNodes.length, 8);
  assert.equal(identityNode?.metadata.route, "/nexus/identity");
  assert.equal(identityNode?.metadata.stateNamespace, "nexus.identity");
  assert.equal(identityNode?.metadata.consumesZarCore, true);
  assert.equal(identityCapability?.owningNodeId, "identity");
  assert.equal(registry.capabilitiesForNode("identity").some((capability) => capability.id === "identity.current-principal"), true);
  assert.equal(registry.capabilitiesForNode("create").length, 0);
});

test("persistent communication layer exposes the six approved modes", () => {
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.id, PERSISTENT_COMMUNICATION_LAYER_ID);
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.metadata.navigationalNode, false);
  assert.deepEqual(
    PERSISTENT_COMMUNICATION_MANIFEST.modes.map((mode) => mode.id),
    [...NEXUS_COMMUNICATION_MODE_IDS],
  );
  assert.deepEqual(
    PERSISTENT_COMMUNICATION_MANIFEST.modes.map((mode) => mode.label),
    ["Text", "Talk", "Image", "Draw", "Doc", "Upload"],
  );
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.modes.every((mode) => mode.surfacePath !== "/nexus/create"), true);
  assert.equal(PERSISTENT_COMMUNICATION_MANIFEST.capabilities.length, 6);
});

test("creation capabilities remain discoverable but independent of root navigation", () => {
  const communicationCapabilities = nexusCapabilityRegistry.byCommunicationLayer(PERSISTENT_COMMUNICATION_LAYER_ID);
  const createText = nexusCapabilityRegistry.get("create.text");

  assert.equal(communicationCapabilities.length, 6);
  assert.equal(createText?.owner.kind, "communication-layer");
  assert.equal(createText?.owningNodeId, null);
  assert.equal(nexusCapabilityRegistry.byOwner("create").length, 0);
  assert.equal(nexusCapabilityRegistry.search("dictation").some((capability) => capability.id === "create.talk"), true);
  assert.equal(nexusCapabilityRegistry.search("document").some((capability) => capability.id === "create.document"), true);
  assert.equal(NEXUS_ROOT_NODES.some((node) => node.id === PERSISTENT_COMMUNICATION_LAYER_ID), false);
});

test("capability graph remains separate from the navigation graph", () => {
  const capabilityGraph = nexusCapabilityRegistry.graphSnapshot();
  const navigationEngine = new NexusConstellationEngine(NEXUS_ROOT_NODES, NEXUS_ROOT_CONNECTIONS);
  const state = navigationEngine.activateNode(navigationEngine.createInitialState(), "settings");
  const navigationSnapshot = navigationEngine.snapshot(state);
  const capabilityGraphAfterNavigation = nexusCapabilityRegistry.graphSnapshot();

  assert.ok(capabilityGraph.edges.length > 0);
  assert.ok(navigationSnapshot.connections.every((connection) => connection.id.startsWith("root-orbit:")));
  assert.ok(capabilityGraph.edges.every((edge) => edge.fromCapabilityId.includes(".")));
  assert.deepEqual(capabilityGraphAfterNavigation, capabilityGraph);
});

test("duplicate node and capability identifiers are rejected", () => {
  assert.throws(
    () => new NexusManifestRegistry([NEXUS_ROOT_MANIFESTS[0], NEXUS_ROOT_MANIFESTS[0]]),
    /node manifest already registered/,
  );

  const duplicateCapability = nodeCapability("extension", "identity.current-principal");
  assert.throws(
    () => new NexusManifestRegistry([NEXUS_ROOT_MANIFESTS[0], extensionManifest("extension", null, [duplicateCapability])]),
    /capability already registered/,
  );

  const existingCapability = PERSISTENT_COMMUNICATION_CAPABILITIES[0];
  assert.throws(
    () => new NexusCapabilityRegistry([existingCapability, existingCapability]),
    /capability already registered/,
  );
});

test("unknown capability dependencies are retained as unresolved graph metadata", () => {
  const registry = new NexusCapabilityRegistry([
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
  const registry = new NexusManifestRegistry([NEXUS_ROOT_MANIFESTS[0], extraManifest]);
  const engine = new NexusConstellationEngine(registry.toNavigationNodes(testVisualMetadata));

  const futureCommunicationCapability = communicationCapability("create.video");
  const capabilityRegistry = new NexusCapabilityRegistry([
    ...nexusCapabilityRegistry.all(),
    futureCommunicationCapability,
  ]);

  assert.equal(engine.getNode("identity-insights")?.parentId, "identity");
  assert.equal(engine.childrenOf("identity").some((node) => node.id === "identity-insights"), true);
  assert.equal(capabilityRegistry.get("create.video")?.owner.id, PERSISTENT_COMMUNICATION_LAYER_ID);
  assert.equal(capabilityRegistry.byCommunicationLayer(PERSISTENT_COMMUNICATION_LAYER_ID).some((capability) => capability.id === "create.video"), true);
  assert.equal(engine.getNode(PERSISTENT_COMMUNICATION_LAYER_ID), null);
});

function testVisualMetadata(manifest: NexusNodeManifest, index: number): NexusVisualMetadata {
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
  capabilities: readonly NexusCapabilityDefinition[],
): NexusNodeManifest {
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

function application(nodeId: string): NexusApplicationBoundary {
  return {
    id: `${nodeId}-application`,
    nodeId,
    label: "Extension",
    basePath: `/nexus/${nodeId}`,
    routePattern: `/nexus/${nodeId}/:view?`,
    stateNamespace: `nexus.${nodeId}`,
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
): NexusCapabilityDefinition {
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
        route: `/nexus/${owningNodeId}`,
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

function communicationCapability(id: string): NexusCapabilityDefinition {
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
