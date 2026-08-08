import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";

import { AuthProvider } from "../../components/auth/AuthContext";
import { NexysHubOverlay } from "../components/NexysHubOverlay";
import { NexysCapabilityRegistry } from "../capabilities/NexysCapabilityRegistry";
import type { NexysCapabilityDefinition } from "../capabilities/types";
import { NEXYS_ROOT_NODES } from "../graph/rootConstellation";
import { nexysDomainsFromRootNodes } from "../scene/nexysDomainAdapter";
import { NexysProvider } from "../state/NexysProvider";
import NexysRootPage from "../pages/NexysRootPage";

function renderNexysHome(pathname = "/nexys") {
  (globalThis as any).location = {
    pathname,
    search: "",
    hash: "",
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: false,
        retry: false,
      },
    },
  });

  // Mirrors App.tsx's exact Route wrapping so useParams() can resolve :nodeId
  // from the mocked pathname the same way it does in the real router.
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NexysProvider>
          <Switch>
            <Route path="/nexys">
              <NexysRootPage />
            </Route>
            <Route path="/nexys/:nodeId/:view?">
              <NexysRootPage />
            </Route>
          </Switch>
        </NexysProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// Note: NexysRootPage sets/clears visual focus and advances target/orbit/hub
// via useEffect, which react-dom/server's renderToStaticMarkup never runs -
// so this SSR harness can't observe *which* node ends up focused (it always
// reflects NexysProvider's initial default), nor anything the WebGL scene
// renders internally (react-three-fiber's Canvas mounts via effects too).
// The focus-resolution logic itself is proven directly against the pure
// viewport model in nexysHomeExperience.test.ts. What this SSR render *can*
// prove is structural: the scene/console/Hub regions' presence per route.

test("STATE 0 (Home): nothing is targeted, so no Hub UI renders at /nexys", () => {
  const html = renderNexysHome("/nexys");

  assert.ok(html.includes('data-nexys-region="scene"'), "scene region present");
  assert.ok(html.includes('data-nexys-region="communication"'), "communication region present");
  assert.ok(
    !html.includes('data-nexys-region="focused"'),
    "Home has nothing selected - the Hub reveal must not render until a hub is targeted",
  );
});

test("STATE 1/2 (Target/Orbit): routing to /nexys/:nodeId does not immediately complete the Hub", () => {
  const html = renderNexysHome("/nexys/memory");

  assert.ok(html.includes('data-nexys-region="scene"'), "scene region present");
  assert.ok(html.includes('data-nexys-region="communication"'), "communication region present");
  assert.ok(
    !html.includes('data-nexys-region="focused"'),
    "the interaction must not immediately be treated as completed Hub state - Hub reveals only once Orbit settles, which a fresh render hasn't done yet",
  );
});

test("an unknown node id still structurally resolves like Home (no Hub UI)", () => {
  const html = renderNexysHome("/nexys/not-a-real-node");

  assert.ok(html.includes('data-nexys-region="scene"'), "scene region present");
  assert.ok(
    !html.includes('data-nexys-region="focused"'),
    "an unknown node id must redirect safely and never fabricate a Hub for it",
  );
});

test("Nexys home is a fixed one-screen shell, not a scrolling page", () => {
  const html = renderNexysHome();

  assert.match(
    html,
    /class="relative h-\[100dvh\] w-full overflow-hidden[^"]*"/,
    "root shell must be viewport-locked with no outer scroll, matching the official full-screen composition",
  );
});

test("the official scene is fed all eight real manifest nodes, never a hardcoded prototype domain list", () => {
  const domains = nexysDomainsFromRootNodes(NEXYS_ROOT_NODES);

  assert.equal(domains.length, 8);
  assert.deepEqual(
    domains.map((d) => d.id).sort(),
    ["connect", "identity", "knowledge", "memory", "projects", "settings", "tools", "workspaces"],
  );
  for (const domain of domains) {
    assert.ok(domain.color.startsWith("#"), `${domain.id} should carry its real manifest color`);
    assert.ok(domain.icon, `${domain.id} should resolve a real icon component`);
  }
});

/**
 * The Hub reveal (NexysHubOverlay) is rendered directly here, bypassing
 * NexysRootPage's target/orbit/hub sequencing - that sequencing depends on
 * effects and timers this SSR-only harness never runs (see
 * pages/__tests__/nexysInteractionStageModel.test.ts for the sequencing
 * logic itself). The overlay is just the back pill and the focused domain's
 * name now - entering a domain happens by tapping the centered planet
 * itself (NexysRootPage's handleFocusedTap), not a separate action row.
 */
function renderHubOverlay(registry?: NexysCapabilityRegistry) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NexysProvider capabilityRegistry={registry}>
          <NexysHubOverlay onBack={() => {}} />
        </NexysProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

test("the Hub reveal has no action-pill row - only the back pill and the focused domain's name", () => {
  const registry = new NexysCapabilityRegistry([
    identityCapability("alpha", "Alpha Action", "/learning"),
    identityCapability("beta", "Beta Action", "/projects"),
    identityCapability("gamma", "Gamma Action", "/workspace"),
  ]);
  const html = renderHubOverlay(registry);

  for (const label of ["Alpha Action", "Beta Action", "Gamma Action"]) {
    assert.doesNotMatch(html, new RegExp(`>${label}<`), `${label} should not render as a separate action pill`);
  }
  assert.match(html, /aria-label="Back to Nexys"/, "Back to Nexys stays visible");
});

function identityCapability(name: string, label: string, route: string): NexysCapabilityDefinition {
  const id = `identity.mobile-test-${name}`;
  return {
    id,
    owner: { kind: "node", id: "identity" },
    owningNodeId: "identity",
    label,
    category: "identity",
    status: "available",
    actions: [{ id: `${id}.primary`, label, kind: "navigate", route, enabled: true }],
    dependencies: [],
    permissions: [{ id: "kernel.authenticated", label: "Authenticated user", source: "kernel", required: true }],
    searchable: { summary: `${label} summary`, terms: [name], aliases: [] },
    metadata: {},
  };
}
