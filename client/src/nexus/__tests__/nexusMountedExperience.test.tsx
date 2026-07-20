import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "../../components/auth/AuthContext";
import { NexusProvider } from "../state/NexusProvider";
import { NexusCommunicationDock } from "../components/NexusCommunicationDock";

function renderNexusCommunication() {
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
          <NexusCommunicationDock />
        </NexusProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

test("mounted Nexus communication surface is ZAR-facing and omits the legacy shell", () => {
  const html = renderNexusCommunication();

  assert.match(html, /Ask ZAR/);
  assert.match(html, /Persistent ZAR communication/);
  assert.doesNotMatch(html, /Message Zed/);
  assert.doesNotMatch(html, /What are we doing/);
  assert.doesNotMatch(html, /Enhanced AI Assistant/);
  assert.doesNotMatch(html, /New Conversation/);
  assert.doesNotMatch(html, /ChatSidebar/);
});
