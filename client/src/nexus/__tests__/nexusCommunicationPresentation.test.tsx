import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { NexusConversationRuntime } from "../components/communication/NexusConversationRuntime";
import type { NexusConversationController } from "../communication/useNexusConversationController";
import type { Message } from "@shared/schema";

function fakeMessage(id: string, role: "user" | "assistant", content: string): Message {
  return {
    id,
    conversationId: "conversation-1",
    role,
    content,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as Message;
}

function renderRuntime(overrides: Partial<NexusConversationController> = {}) {
  const controller: NexusConversationController = {
    conversation: undefined,
    conversationId: "conversation-1",
    title: "Existing conversation",
    files: [],
    messages: [
      fakeMessage("message-1", "user", "Open Memory"),
      fakeMessage("message-2", "assistant", "Memory is now in focus."),
    ],
    isStreaming: false,
    streamingMessage: "",
    hasStartedTyping: true,
    showFileUpload: false,
    activeUploadConversationId: "conversation-1",
    composerValue: "Draft response",
    editingMessageId: "message-1",
    compactMessages: false,
    fontSize: "medium",
    showTimestamps: true,
    runtimeError: null,
    messagesEndRef: { current: null },
    setComposerValue: () => undefined,
    sendMessage: async () => undefined,
    abort: () => undefined,
    openFileUpload: async () => undefined,
    ensureUploadConversationId: async () => null,
    closeFileUpload: () => undefined,
    handleFileUpload: () => undefined,
    archiveConversation: async () => undefined,
    copyMessage: async () => undefined,
    editMessage: () => undefined,
    cancelEdit: () => undefined,
    ...overrides,
  };

  return renderToStaticMarkup(<NexusConversationRuntime controller={controller} />);
}

test("Nexus conversation runtime renders native communication primitives", () => {
  const html = renderRuntime();

  assert.match(html, /data-nexus-conversation-runtime="true"/);
  assert.match(html, /Existing conversation/);
  assert.match(html, /Ask ZAR/);
  assert.match(html, /Attach a file/);
  assert.match(html, /Voice input unavailable/);
  assert.match(html, /Copy/);
  assert.match(html, /Edit/);
  assert.match(html, /Editing message draft/);
  assert.doesNotMatch(html, /What are we doing/);
  assert.doesNotMatch(html, /Say the outcome/);
  assert.doesNotMatch(html, /Message Zed/);
  assert.doesNotMatch(html, /Enhanced AI Assistant/);
  assert.doesNotMatch(html, /New Conversation/);
  assert.doesNotMatch(html, /zed-glass/);
});

test("Nexus runtime exposes abort control during response generation", () => {
  const html = renderRuntime({
    isStreaming: true,
    composerValue: "",
    editingMessageId: null,
  });

  assert.match(html, /Stop generation/);
  assert.doesNotMatch(html, /Message Zed/);
});
