import { useEffect, useRef } from "react";

import { useLocationSearch } from "@/lib/useLocationSearch";
import { useNexysConsoleChat } from "@/nexys/communication/NexysConsoleChatContext";
import { NexysConversationRuntime } from "@/nexys/components/communication/NexysConversationRuntime";

/**
 * The display surface ZAR's Chat Dock control opens. The persistent Console
 * session is shared with the Dock, so this page renders the conversation
 * while every user input remains in the Dock. Rendered inside
 * ConsoleWorkspaceFrame (flush), it only fills the dock-aware parent.
 */
export default function ChatPage() {
  const search = useLocationSearch();
  const { controller } = useNexysConsoleChat();

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

  return <NexysConversationRuntime controller={controller} showInputControls={false} />;
}
