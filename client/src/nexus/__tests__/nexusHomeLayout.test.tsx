import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "../../components/auth/AuthContext";
import { NexusProvider } from "../state/NexusProvider";
import NexusRootPage from "../pages/NexusRootPage";

function renderNexusHome() {
  (globalThis as any).location = {
    pathname: "/nexus",
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

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NexusProvider>
          <NexusRootPage />
        </NexusProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

test("Nexus home keeps document order header -> constellation -> communication -> focused context", () => {
  const html = renderNexusHome();

  const constellationIndex = html.indexOf('data-nexus-region="constellation"');
  const communicationIndex = html.indexOf('data-nexus-region="communication"');
  const focusedIndex = html.indexOf('data-nexus-region="focused"');

  assert.ok(constellationIndex >= 0, "constellation region present");
  assert.ok(communicationIndex >= 0, "communication region present");
  assert.ok(focusedIndex >= 0, "focused region present");
  assert.ok(
    constellationIndex < communicationIndex && communicationIndex < focusedIndex,
    "mobile document order must be constellation, then communication, then focused context",
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

test("Nexus home renders a compact mobile focused-context strip alongside the full desktop panel", () => {
  const html = renderNexusHome();

  assert.match(html, /id="nexus-focused-node-title-compact"/, "compact focused strip renders on mobile");
  assert.match(html, /id="nexus-focused-node-title"/, "full focused panel renders for the desktop aside");
});
