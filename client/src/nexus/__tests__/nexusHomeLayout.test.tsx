import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";

import { AuthProvider } from "../../components/auth/AuthContext";
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

test("STATE 0 (Home): nothing is targeted, so no Hub UI renders at /nexus", () => {
  const html = renderNexusHome("/nexus");

  assert.ok(html.includes('data-nexus-region="constellation"'), "constellation region present");
  assert.ok(html.includes('data-nexus-region="communication"'), "communication region present");
  assert.ok(
    !html.includes('data-nexus-region="focused"'),
    "Home has nothing selected - the Hub reveal must not render until a hub is targeted",
  );
});

test("STATE 2/3 (Orbit/Hub): targeting a hub via /nexus/:nodeId keeps document order and reveals the Hub", () => {
  const html = renderNexusHome("/nexus/memory");

  const constellationIndex = html.indexOf('data-nexus-region="constellation"');
  const communicationIndex = html.indexOf('data-nexus-region="communication"');
  const focusedIndex = html.indexOf('data-nexus-region="focused"');

  assert.ok(constellationIndex >= 0, "constellation region present");
  assert.ok(communicationIndex >= 0, "communication region present");
  assert.ok(focusedIndex >= 0, "Hub reveal renders once a node is targeted");
  assert.ok(
    constellationIndex < communicationIndex && communicationIndex < focusedIndex,
    "mobile document order must be constellation, then communication, then the Hub reveal",
  );
  assert.match(html, /aria-label="Back to Nexus"/, "Hub -> Back -> Home affordance is present");
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

test("Nexus home renders a compact mobile focused-context strip alongside the full desktop panel", () => {
  const html = renderNexusHome("/nexus/memory");

  assert.match(html, /id="nexus-focused-node-title-compact"/, "compact focused strip renders on mobile");
  assert.match(html, /id="nexus-focused-node-title"/, "full focused panel renders for the desktop aside");
});
