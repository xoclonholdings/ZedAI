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

test("Nexus constellation only labels focused and near nodes, not edge nodes", () => {
  const html = renderNexusHome();

  assert.match(html, /aria-label="ZAR Nexus constellation"/);
  assert.match(html, /In focus/);

  const edgeButtonPattern = /aria-label="Focus [^"]+"[^>]*>(?:(?!<\/button>).)*?<\/button>/gs;
  const buttons = html.match(edgeButtonPattern) ?? [];
  assert.ok(buttons.length > 0, "at least one focusable Nexus node rendered");
});
