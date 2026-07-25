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

test("mounted Nexus communication surface is ZAR-facing and omits the legacy shell", () => {
  // Emergent's official console is collapsed by default: mode row + voice
  // dock + History/Memory Context, no transcript panel occupying the space
  // until the user asks for it - matching the approved composition.
  const html = renderNexusCommunication();

  assert.match(html, /Persistent ZAR communication/);
  assert.match(html, /Online/, "the official ZAR . Online status reads exactly as approved");
  assert.doesNotMatch(html, /data-nexus-conversation-runtime="true"/, "transcript stays collapsed until History is opened");
  assert.match(html, /data-nexus-voice=/, "voice dock (waveform + mic) is part of the communication surface");
  assert.match(html, /Voice input unavailable|Talk to ZAR/);
  assert.match(html, /History/);
  assert.match(html, /Memory Context/);
  assert.doesNotMatch(html, /Message Zed/);
  assert.doesNotMatch(html, /What are we doing/);
  assert.doesNotMatch(html, /Enhanced AI Assistant/);
  assert.doesNotMatch(html, /New Conversation/);
  assert.doesNotMatch(html, /ChatSidebar/);
  assert.doesNotMatch(html, /data-legacy-chat-area/);
});

test("deep-linking into a specific conversation opens straight to its transcript", () => {
  const html = renderNexusCommunication("conversation-42");

  assert.match(html, /data-nexus-conversation-runtime="true"/, "a direct conversation link shouldn't hide its own transcript");
  assert.match(html, /Ask ZAR/);
});
