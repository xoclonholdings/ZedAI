import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";

import { AuthProvider } from "../../components/auth/AuthContext";
import { NexusProvider } from "../../nexus/state/NexusProvider";
import NexusRootPage from "../../nexus/pages/NexusRootPage";
import { ConsoleWorkspaceFrame } from "../ConsoleWorkspaceFrame";

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
}

function renderHome(pathname = "/nexus") {
  (globalThis as any).location = { pathname, search: "", hash: "" };
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient()}>
      <AuthProvider>
        <NexusProvider>
          <Switch>
            <Route path="/nexus">
              <NexusRootPage />
            </Route>
          </Switch>
        </NexusProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function renderWorkspaceFrame(pathname: string) {
  (globalThis as any).location = { pathname, search: "", hash: "" };
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient()}>
      <AuthProvider>
        <NexusProvider>
          <ConsoleWorkspaceFrame nodeId="identity">
            <div data-test-page-content="identity">Personal notes</div>
          </ConsoleWorkspaceFrame>
        </NexusProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

test("home (ConsoleShell in home mode) renders the Console Activator and the standby dock, not the old inert sparkle button", () => {
  const html = renderHome("/nexus");
  assert.match(html, /Power console up/, "activator button is present with its power-state aria-label");
  assert.doesNotMatch(html, /aria-label="Ask ZAR"/, "the old inert sparkle button is gone");
  assert.match(html, /Ask ZAR anything/, "standby composer placeholder is present (dock starts powered off)");
  assert.match(html, /data-nexus-region="communication"/, "dock region marker preserved for existing layout tests");
  assert.match(html, /data-nexus-region="scene"/, "scene region marker preserved");
});

test("ConsoleWorkspaceFrame wraps embedded page content with a back-to-Nexus control and node label, no duplicate chrome", () => {
  const html = renderWorkspaceFrame("/identity");
  assert.match(html, /aria-label="Back to Nexus"/, "back-to-Nexus control present");
  assert.match(html, /NEXUS<\/button>/, "back control labels the galaxy console");
  assert.match(html, /IDENTITY/, "node label pill shows the embedded root node");
  assert.match(html, /data-test-page-content="identity"/, "the wrapped page content actually renders inside the shell");
  assert.match(html, /Power console up/, "the shared Console Activator is present in workspace mode too");
  assert.match(html, /Ask ZAR anything/, "the persistent dock is attached in workspace mode too");
});
