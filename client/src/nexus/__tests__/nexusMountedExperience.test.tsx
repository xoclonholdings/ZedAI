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

test("mounted Nexus communication surface is NEXUS-facing, defaults to the mic slot, and omits the legacy shell", () => {
  // The dock's one content slot defaults to the mic (Talk) - Text opens the
  // real chat page instead of an inline composer, and there's no separate
  // Memory Context layer (Memory is its own Nexus planet).
  const html = renderNexusCommunication();

  assert.match(html, /Persistent NEXUS communication/);
  assert.match(html, /NEXUS/, "the dock carries the NEXUS console label");
  assert.match(html, /Online/, "the connectivity indicator's Online status reads exactly as approved");
  assert.match(html, /data-nexus-voice=/, "the mic slot is the default content");
  assert.match(html, /Voice input unavailable|Talk to ZAR/);
  assert.doesNotMatch(html, /Ask ZAR/, "no composer/empty-state text shows in the dock");
  assert.match(html, /History/);
  assert.doesNotMatch(html, /Memory Context/, "Memory Context was removed - Memory is its own Nexus planet");
  assert.doesNotMatch(html, /Message Zed/);
  assert.doesNotMatch(html, /What are we doing/);
  assert.doesNotMatch(html, /Enhanced AI Assistant/);
  assert.doesNotMatch(html, /New Conversation/);
  assert.doesNotMatch(html, /ChatSidebar/);
  assert.doesNotMatch(html, /data-legacy-chat-area/);
});
