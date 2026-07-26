import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "../../components/auth/AuthContext";
import { NexusProvider } from "../state/NexusProvider";
import { NexusCommunicationDock } from "../components/NexusCommunicationDock";

function renderNexusCommunication(conversationId?: string) {
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
          <NexusCommunicationDock conversationId={conversationId} />
        </NexusProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

test("mounted Nexus communication surface is ZAR-facing, defaults to the mic slot, and omits the legacy shell", () => {
  // The dock's one content slot defaults to the mic (Talk) - no separate
  // transcript panel, no "Ask ZAR" empty state, ever.
  const html = renderNexusCommunication();

  assert.match(html, /Persistent ZAR communication/);
  assert.match(html, /Online/, "the official ZAR . Online status reads exactly as approved");
  assert.match(html, /data-nexus-voice=/, "the mic slot is the default content");
  assert.match(html, /Voice input unavailable|Talk to ZAR/);
  assert.doesNotMatch(html, /Ask ZAR/, "no composer/empty-state text shows until Text is tapped");
  assert.match(html, /History/);
  assert.match(html, /Memory Context/);
  assert.doesNotMatch(html, /Message Zed/);
  assert.doesNotMatch(html, /What are we doing/);
  assert.doesNotMatch(html, /Enhanced AI Assistant/);
  assert.doesNotMatch(html, /New Conversation/);
  assert.doesNotMatch(html, /ChatSidebar/);
  assert.doesNotMatch(html, /data-legacy-chat-area/);
});

test("deep-linking into a specific conversation opens straight to the composer slot", () => {
  const html = renderNexusCommunication("conversation-42");

  assert.match(html, /Ask ZAR/, "the composer (not the mic) is the default slot content for a direct conversation link");
  assert.doesNotMatch(html, /data-nexus-voice=/, "the mic slot isn't shown at the same time as the composer");
});
