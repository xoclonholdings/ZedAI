import { useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft } from "lucide-react";

import { useLocationSearch } from "@/lib/useLocationSearch";
import { useNexusChatSession } from "@/nexus/communication/useNexusChatSession";
import { NexusConversationRuntime } from "@/nexus/components/communication/NexusConversationRuntime";

function normalizeConversationId(value: string | null | undefined): string | undefined {
  if (!value || value === "undefined" || value === "null") return undefined;
  return value;
}

/**
 * The real chat page ZAR's "Text" mode opens to - interim, per the user's
 * explicit "for now, we will redesign later." Reuses the same session logic
 * (useNexusChatSession) and runtime UI the console's inline composer was
 * built on, so workspace/learning context and ZAR-driven navigation behave
 * identically here and in the dock.
 */
export default function ChatPage() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const search = useLocationSearch();
  const conversationId = normalizeConversationId(id);

  const { controller } = useNexusChatSession(conversationId, {
    onModeAction: () => navigate("/nexus"),
  });

  // A conversation created from a blank /chat lands on its own id once the
  // first message goes out, so refresh/back/share keep pointing at it.
  useEffect(() => {
    if (controller.conversationId && controller.conversationId !== conversationId) {
      navigate(`/chat/${controller.conversationId}`, { replace: true });
    }
  }, [controller.conversationId, conversationId, navigate]);

  // A dictated draft from the console's Talk mode arrives as ?draft=... -
  // picked up once, then left alone so retyping doesn't keep resetting it.
  const draftApplied = useRef(false);
  useEffect(() => {
    if (draftApplied.current) return;
    draftApplied.current = true;
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const draft = params.get("draft");
    if (draft) controller.setComposerValue(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-black text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe-sm zar-glass">
        <button
          type="button"
          onClick={() => navigate("/nexus")}
          className="zar-button flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[13px] text-white/80"
        >
          <ChevronLeft size={16} />
          Nexus
        </button>
        <span className="truncate text-[13px] font-medium text-white/70">{controller.title}</span>
        <div className="h-9 w-9" aria-hidden="true" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-2 sm:px-3">
        <NexusConversationRuntime controller={controller} />
      </div>
    </div>
  );
}
