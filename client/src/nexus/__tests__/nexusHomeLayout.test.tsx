import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";

import { AuthProvider } from "../../components/auth/AuthContext";
import { NexusFocusedNodePanel } from "../components/NexusFocusedNodePanel";
import { NexusCapabilityRegistry } from "../capabilities/NexusCapabilityRegistry";
import type { NexusCapabilityDefinition } from "../capabilities/types";
import { NexusProvider } from "../state/NexusProvider";
import NexusRootPage from "../pages/NexusRootPage";

function renderNexusHome(pathname = "/nexus") {
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
        <NexusProvider>
          <Switch>
            <Route path="/nexus">
              <NexusRootPage />
            </Route>
            <Route path="/nexus/:nodeId/:view?">
              <NexusRootPage />
            </Route>
          </Switch>
        </NexusProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// Note: NexusRootPage sets/clears visual focus and advances target/orbit/hub
// via useEffect, which react-dom/server's renderToStaticMarkup never runs -
// so this SSR harness can't observe *which* node ends up focused (it always
// reflects NexusProvider's initial default). The focus-resolution logic
// itself (routing to the right node, clearing to null at Home) is proven
// directly against the pure viewport model in nexusHomeExperience.test.ts
// ("returning to Home clears visual focus...", "touch or programmatic focus
// can select a node..."). What this SSR render *can* prove is structural:
// the Hub reveal's presence/absence per route.

test("STATE 0 (Home): nothing is targeted, so no Hub UI renders at /nexus", () => {
  const html = renderNexusHome("/nexus");

  assert.ok(html.includes('data-nexus-region="constellation"'), "constellation region present");
  assert.ok(html.includes('data-nexus-region="communication"'), "communication region present");
  assert.ok(
    !html.includes('data-nexus-region="focused"'),
    "Home has nothing selected - the Hub reveal must not render until a hub is targeted",
  );
});

test("STATE 1/2 (Target/Orbit): routing to /nexus/:nodeId does not immediately complete the Hub", () => {
  const html = renderNexusHome("/nexus/memory");

  const constellationIndex = html.indexOf('data-nexus-region="constellation"');
  const communicationIndex = html.indexOf('data-nexus-region="communication"');

  assert.ok(constellationIndex >= 0, "constellation region present");
  assert.ok(communicationIndex >= 0, "communication region present");
  assert.ok(
    !html.includes('data-nexus-region="focused"'),
    "the interaction must not immediately be treated as completed Hub state - Hub reveals only once Orbit settles, which a fresh render hasn't done yet",
  );
});

test("an unknown node id still structurally resolves like Home (no Hub UI)", () => {
  const html = renderNexusHome("/nexus/not-a-real-node");

  assert.ok(html.includes('data-nexus-region="constellation"'), "constellation region present");
  assert.ok(
    !html.includes('data-nexus-region="focused"'),
    "an unknown node id must redirect safely and never fabricate a Hub for it",
  );
});

test("Nexus constellation shows all eight root nodes at once, matching the mockup", () => {
  const html = renderNexusHome();

  assert.match(html, /aria-label="ZAR Nexus constellation"/);

  for (const label of ["Identity", "Memory", "Knowledge", "Workspaces", "Projects", "Tools", "Connect", "Settings"]) {
    assert.match(html, new RegExp(`>${label}<`), `${label} node label should always be visible`);
  }

  const focusableButtonPattern = /aria-label="(?:Focus|Focused) [^"]+"[^>]*>/g;
  const buttons = html.match(focusableButtonPattern) ?? [];
  assert.equal(buttons.length, 8, "all eight root nodes should be focusable buttons");
});

test("Nexus home is a fixed one-screen shell, not a scrolling page", () => {
  const html = renderNexusHome();

  assert.match(
    html,
    /class="flex h-\[100dvh\] flex-col overflow-hidden[^"]*"/,
    "root shell must be viewport-locked with no outer scroll, matching the mockup's single-screen layout",
  );
  assert.doesNotMatch(
    html,
    /min-h-\[480px\]/,
    "the conversation runtime must not force a fixed minimum height that can overflow a short viewport",
  );
});

/**
 * The Hub reveal itself (NexusFocusedNodePanel) is rendered directly here,
 * bypassing NexusRootPage's target/orbit/hub sequencing - that sequencing
 * depends on effects and timers this SSR-only harness never runs (see
 * pages/__tests__/nexusInteractionStageModel.test.ts for the sequencing
 * logic itself). The panel's own rendering - full desktop card alongside
 * the compact mobile strip, and the strip exposing every action - is
 * independent of which stage revealed it.
 */
function renderFocusedNodePanels(registry?: NexusCapabilityRegistry) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NexusProvider capabilityRegistry={registry}>
          <NexusFocusedNodePanel variant="compact" onEnterAction={() => {}} onBack={() => {}} />
          <NexusFocusedNodePanel variant="panel" onEnterAction={() => {}} onBack={() => {}} />
        </NexusProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

test("Nexus Hub renders a compact mobile focused-context strip alongside the full desktop panel", () => {
  const html = renderFocusedNodePanels();

  assert.match(html, /id="nexus-focused-node-title-compact"/, "compact focused strip renders on mobile");
  assert.match(html, /id="nexus-focused-node-title"/, "full focused panel renders for the desktop aside");
});

test("Mobile Hub exposes every available action, not only the first", () => {
  const registry = new NexusCapabilityRegistry([
    identityCapability("alpha", "Alpha Action", "/learning"),
    identityCapability("beta", "Beta Action", "/projects"),
    identityCapability("gamma", "Gamma Action", "/workspace"),
  ]);
  const html = renderFocusedNodePanels(registry);

  for (const label of ["Alpha Action", "Beta Action", "Gamma Action"]) {
    assert.match(html, new RegExp(`>${label}<`), `${label} chip should be discoverable on mobile, not just the first`);
  }
  assert.match(html, /aria-label="Back to Nexus"/, "Back to Nexus stays visible alongside the action chips");
});

function identityCapability(name: string, label: string, route: string): NexusCapabilityDefinition {
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
