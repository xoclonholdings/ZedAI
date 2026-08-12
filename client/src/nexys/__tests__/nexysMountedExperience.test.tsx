import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "../../components/auth/AuthContext";
import { NexysProvider } from "../state/NexysProvider";
import { NexysCommunicationDock } from "../components/NexysCommunicationDock";

function renderNexysCommunication() {
  (globalThis as any).location = {
    pathname: "/nexys",
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
        <NexysProvider>
          <NexysCommunicationDock />
        </NexysProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

test("mounted Nexys dock is NEXYS-facing, exposes five controls, and keeps History outside them", () => {
  const html = renderNexysCommunication();

  assert.match(html, /Persistent NEXYS communication/);
  assert.match(html, /NEXYS/, "the dock carries the NEXYS console label");
  assert.match(html, /Online/, "the connectivity indicator's Online status reads exactly as approved");
  for (const label of ["Chat", "Upload", "Ideas", "Task", "Search"]) {
    assert.match(html, new RegExp(`aria-label="${label}"`), `${label} is a primary Dock control`);
  }
  assert.doesNotMatch(html, /aria-label="Image"/, "Image branches from Upload instead of occupying the Dock");
  assert.doesNotMatch(html, /aria-label="Document"/, "Document branches from Upload instead of occupying the Dock");
  assert.doesNotMatch(html, /Ask ZAR/, "no composer/empty-state text shows in the dock");
  assert.match(html, /History/);
  assert.doesNotMatch(html, /Memory Context/, "Memory Context was removed - Memory is its own Nexys planet");
  assert.doesNotMatch(html, /Message ZAR/);
  assert.doesNotMatch(html, /What are we doing/);
  assert.doesNotMatch(html, /Enhanced AI Assistant/);
  assert.doesNotMatch(html, /New Conversation/);
  assert.doesNotMatch(html, /ChatSidebar/);
  assert.doesNotMatch(html, /data-legacy-chat-area/);
});
