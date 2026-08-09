import { useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";

import { useLocationSearch } from "@/lib/useLocationSearch";
import { useNexysChatSession } from "@/nexys/communication/useNexysChatSession";
import { NexysConversationRuntime } from "@/nexys/components/communication/NexysConversationRuntime";

function normalizeConversationId(value: string | null | undefined): string | undefined {
  if (!value || value === "undefined" || value === "null") return undefined;
  return value;
}

/**
 * The real chat page ZAR's "Chat" mode opens to. Reuses the same session
 * logic (useNexysChatSession) and runtime UI the console's inline composer
 * was built on, so workspace/learning context and ZAR-driven navigation
 * behave identically here and in the dock. Rendered inside
 * ConsoleWorkspaceFrame (flush), so it only needs to fill its bounded
 * parent - no page-level chrome or viewport sizing of its own.
 */
export default function ChatPage() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const search = useLocationSearch();
  const conversationId = normalizeConversationId(id);

  const { controller } = useNexysChatSession(conversationId, {
    onModeAction: () => navigate("/nexys"),
  });

  // A conversation created from a blank /chat lands on its own id once the
  // first message goes out, so refresh/back/share keep pointing at it.
  useEffect(() => {
    if (controller.conversationId && controller.conversationId !== conversationId) {
      navigate(`/chat/${controller.conversationId}`, { replace: true });
    }
  }, [controller.conversationId, conversationId, navigate]);

  // Legacy dictated drafts remain supported for compatible deep links.
  const draftApplied = useRef(false);
  useEffect(() => {
    if (draftApplied.current) return;
    draftApplied.current = true;
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const draft = params.get("draft");
    if (draft) controller.setComposerValue(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <NexysConversationRuntime controller={controller} />;
}
