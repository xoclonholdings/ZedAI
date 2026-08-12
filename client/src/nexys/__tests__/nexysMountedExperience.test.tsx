import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "../../components/auth/AuthContext";
import { NexysConsoleChatProvider } from "../communication/NexysConsoleChatContext";
import { NexysDockAttentionProvider } from "../notifications/NexysDockAttentionContext";
import { NexysProvider } from "../state/NexysProvider";
import { NexysCommunicationDock } from "../components/NexysCommunicationDock";
import { NexysConversationSurface, type NexysDockMode } from "../components/NexysConversationSurface";
import { ConsoleBrowserProvider } from "../../console/ConsoleBrowserContext";
import IdeasPage from "../../pages/ideas";
import TasksPage from "../../pages/tasks";

function renderNexysCommunication(initialMode?: NexysDockMode, withTaskAttention = false) {
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
  if (withTaskAttention) {
    queryClient.setQueryData(["/api/approval/notifications?unread=true"], {
      notifications: [{
        id: "notification-1",
        approval_required: true,
        read: false,
        target_surface: "task",
      }],
    });
  }

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NexysProvider>
          <NexysDockAttentionProvider>
            <NexysConsoleChatProvider>
              <ConsoleBrowserProvider>
                {initialMode ? <NexysConversationSurface initialMode={initialMode} /> : <NexysCommunicationDock />}
              </ConsoleBrowserProvider>
            </NexysConsoleChatProvider>
          </NexysDockAttentionProvider>
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
  assert.match(html, /aria-label="Ask ZAR"/, "Chat input lives in the Dock");
  assert.equal((html.match(/aria-label="Ask ZAR"/g) || []).length, 1, "the Dock exposes one Chat composer");
  assert.match(html, /History/);
  assert.doesNotMatch(html, /Memory Context/, "Memory Context was removed - Memory is its own Nexys planet");
  assert.doesNotMatch(html, /Message ZAR/);
  assert.doesNotMatch(html, /What are we doing/);
  assert.doesNotMatch(html, /Enhanced AI Assistant/);
  assert.doesNotMatch(html, /New Conversation/);
  assert.doesNotMatch(html, /ChatSidebar/);
  assert.doesNotMatch(html, /data-legacy-chat-area/);
});

test("Upload owns document/file intake and Add knowledge without adding Dock buttons", () => {
  const html = renderNexysCommunication("upload");

  for (const label of ["Image", "Document", "File", "Add knowledge"]) {
    assert.match(html, new RegExp(`>${label}<`), `${label} is inside Upload`);
  }
  assert.equal((html.match(/aria-label="Upload"/g) || []).length, 1, "Upload remains one primary Dock control");
});

test("Ideas puts its input and Save action in the Dock", () => {
  const html = renderNexysCommunication("ideas");

  assert.match(html, /aria-label="Idea input"/);
  assert.match(html, /aria-label="Save idea"/);
  assert.match(html, /placeholder="Drop an idea..."/);
  assert.doesNotMatch(html, /aria-label="Ask ZAR"/);
});

test("Ideas console screen displays saved blurbs without accepting input", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  });
  queryClient.setQueryData(["/api/knowledge/scratchpad"], {
    items: [{ id: "idea-1", content: "A saved idea", tags: ["idea"] }],
  });

  const html = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <IdeasPage />
    </QueryClientProvider>,
  );

  assert.match(html, /data-ideas-screen="output-only"/);
  assert.match(html, /A saved idea/);
  assert.doesNotMatch(html, /<textarea/);
  assert.doesNotMatch(html, /Save idea/);
  assert.doesNotMatch(html, /Delete idea/);
});

test("Task puts creation and task actions in the Dock", () => {
  const html = renderNexysCommunication("task");

  assert.match(html, /data-task-dock="input-and-actions"/);
  assert.match(html, /aria-label="Task input"/);
  assert.match(html, /aria-label="Task date and time"/);
  assert.match(html, /aria-label="Save task"/);
  assert.doesNotMatch(html, /aria-label="Ask ZAR"/);
});

test("Search keeps only its input and save action in the Dock", () => {
  const html = renderNexysCommunication("search");

  assert.match(html, /aria-label="Search or website address"/);
  assert.match(html, /aria-label="Search"/);
  assert.match(html, /aria-label="Save website to Knowledge UGC"/);
  assert.doesNotMatch(html, /Nothing browsed yet/);
  assert.doesNotMatch(html, /Failed to load/);
  assert.equal((html.match(/<input/g) || []).length, 1, "Search has one input and it belongs to the Dock");
});

test("Task console displays a row list without accepting input", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  });
  queryClient.setQueryData(["/api/execution/tasks"], {
    tasks: [{
      id: "task-1",
      status: "pending",
      plan: { summary: "A saved task" },
      acceptance_status: "accepted",
      approval_status: "not_required",
      assignee: "user",
    }],
  });

  const html = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <TasksPage />
    </QueryClientProvider>,
  );

  assert.match(html, /data-task-screen="output-only"/);
  assert.match(html, /data-list-presentation="rows"/);
  assert.match(html, /A saved task/);
  assert.doesNotMatch(html, /<input/);
  assert.doesNotMatch(html, /<button/);
  assert.doesNotMatch(html, /aria-label="Add task"/);
});

test("an unread ZAR suggestion marks the Task control without creating a sixth button", () => {
  const html = renderNexysCommunication(undefined, true);

  assert.match(html, /Task needs attention/);
  assert.equal((html.match(/aria-label="(Chat|Upload|Ideas|Task|Search)"/g) || []).length, 5);
});
