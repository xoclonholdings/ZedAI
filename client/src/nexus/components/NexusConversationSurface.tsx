import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, FileText, Globe, Image, MessageCircle, Mic, PenTool, Upload } from "lucide-react";
import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import type { Conversation } from "@shared/schema";
import { useNexusChatSession } from "../communication/useNexusChatSession";
import { useNexusDictation } from "../communication/useNexusDictation";
import { NexusDrawCanvas } from "./communication/NexusDrawCanvas";
import { NexusFileUpload } from "./communication/NexusFileUpload";
import { NexusLiveBrowser } from "./communication/NexusLiveBrowser";
import { NexusMemoryUpload } from "./communication/NexusMemoryUpload";
import { NexusVoiceDock } from "./communication/NexusVoiceDock";
import ResearchDocuments from "@/components/research/ResearchDocuments";
import { useNexus } from "../state/NexusProvider";
import {
  communicationModeViews,
  type NexusCommunicationModeView,
} from "../viewport/NexusViewportModel";

/**
 * What's showing in the console's one content slot, where the mic sits by
 * default - Talk/Image/Doc/Upload/History all swap this slot's content.
 * Browse swaps in just its compact address bar here (NexusLiveBrowser); the
 * fetched page itself renders full-size in the console's main content
 * region instead (ConsoleBrowserFullPage), the same place every workspace
 * renders. Text opens the real chat page instead of a slot (interim, per
 * the redesign note), so it isn't a slot mode here. The dock around the
 * slot (status row, mode row, this slot, footer row) never changes shape or
 * grows - only the slot's content changes.
 */
export type NexusDockMode = "talk" | "image" | "draw" | "doc" | "upload" | "history" | "browse";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const IMAGE_ACCEPT = "image/*";

export function NexusConversationSurface({
  initialMode,
}: {
  /** Which slot to open with - set by the console dock when a specific tool icon requested power-on. */
  readonly initialMode?: NexusDockMode;
} = {}) {
  const [, navigate] = useLocation();
  const { viewportSnapshot, communicationLayer } = useNexus();
  const [status, setStatus] = useState("Ready");
  const [activeMode, setActiveMode] = useState<NexusDockMode>(initialMode ?? "talk");

  const goToChat = useCallback((conversationId?: string) => {
    navigate(conversationId ? `/chat/${conversationId}` : "/chat");
  }, [navigate]);

  const { controller: conversationController, activeConversationId } = useNexusChatSession(undefined, {
    onModeAction: (modeId) => handleModeSelect(modeId),
  });

  const modes = useMemo(() => communicationModeViews(communicationLayer), [communicationLayer]);
  const focusedLabel = viewportSnapshot.focusedNode?.label ?? "Nexus";
  // Workspace selection subtly tints the console's accent (spec: "may influence
  // accent colors ... contextual controls"); the surface itself stays persistent.
  const accentColor = viewportSnapshot.focusedNode?.metadata.visual.color ?? "#22d3ee";

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 30000,
  });

  // Owned here (not inside NexusVoiceDock) so the "Talk" mode button below
  // can trigger the exact same dictation toggle as the persistent mic button.
  // A finished dictation hands its transcript to the real chat page (as a
  // draft, via query param) rather than an inline composer, since Text no
  // longer has one.
  const dictation = useNexusDictation((text) => {
    goToChat();
    navigate(`/chat?draft=${encodeURIComponent(text)}`, { replace: true });
  });

  // Each mode button performs the real action it names. Text leaves the
  // dock entirely for the real chat page; the rest use the console's own
  // one content slot, since the dock is a persistent overlay, not a page.
  function handleModeSelect(modeId: string) {
    switch (modeId) {
      case "text":
        goToChat(activeConversationId);
        return;
      case "talk":
        dictation.toggle();
        setActiveMode("talk");
        return;
      case "image":
        setActiveMode("image");
        void conversationController.openFileUpload();
        return;
      case "upload":
        // A memory upload isn't a chat attachment - no conversation needed.
        setActiveMode("upload");
        return;
      case "doc":
        setActiveMode("doc");
        return;
      case "draw":
        setActiveMode("draw");
        return;
      default:
        setStatus(`${modeId} is not available yet`);
    }
  }

  return (
    <section
      className="relative flex w-full flex-col overflow-hidden border border-b-0 border-indigo-400/25 bg-gradient-to-b from-[#0d0a1f] via-[#0a0718] to-[#070512] px-4 pb-3 pt-3 shadow-[0_-10px_60px_-15px_rgba(99,102,241,0.45)] backdrop-blur-2xl transition-colors duration-500 sm:px-5 sm:pb-4"
      style={{
        borderColor: `${accentColor}40`,
        clipPath: "polygon(0 22px, 7% 22px, 10% 0, 90% 0, 93% 22px, 100% 22px, 100% 100%, 0 100%)",
      }}
      aria-label="Persistent NEXUS communication"
    >
      {/* edge accent lights - the console's own identity, in Emergent's visual language */}
      <div
        className="pointer-events-none absolute left-0 top-1/2 h-14 w-[3px] -translate-y-1/2 rounded-r blur-[1px] transition-colors duration-700"
        style={{ background: `linear-gradient(to bottom, ${accentColor}b0, #a855f7b0)` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-0 top-1/2 h-14 w-[3px] -translate-y-1/2 rounded-l blur-[1px] transition-colors duration-700"
        style={{ background: `linear-gradient(to bottom, #a855f7b0, ${accentColor}b0)` }}
        aria-hidden="true"
      />

      <div className="mb-2 mt-3 flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-[nexus-pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
          NEXUS
        </span>
        <span className="text-[11px] text-emerald-400">&middot; Online</span>
        {status !== "Ready" && (
          <span className="truncate text-[12px] text-white/55">{status}</span>
        )}
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-black/40 px-2 py-1.5">
        <div className="flex items-center justify-around gap-1" aria-label={`${focusedLabel} communication modes`}>
          {modes.map((mode) => (
            <CommunicationModeButton
              key={mode.id}
              mode={mode}
              active={activeMode === mode.id}
              onSelect={() => handleModeSelect(mode.id)}
            />
          ))}
        </div>
      </div>

      {/*
        The one content slot - exactly one of these is shown at a time,
        swapped by whichever tab is active. Nothing here ever grows past its
        own bounded content or pushes the rows around it.
      */}
      <div className="mb-3 flex min-h-[101px] flex-col justify-center">
        {activeMode === "talk" && (
          <NexusVoiceDock dictation={dictation} isResponding={conversationController.isStreaming} />
        )}

        {activeMode === "image" && (
          conversationController.showFileUpload && conversationController.activeUploadConversationId ? (
            <NexusFileUpload
              conversationId={conversationController.activeUploadConversationId}
              onUpload={conversationController.handleFileUpload}
              onClose={() => setActiveMode("talk")}
              accept={IMAGE_ACCEPT}
              allowedTypes={IMAGE_TYPES}
              label="Tap to upload an image"
            />
          ) : (
            <div className="flex h-[104px] items-center justify-center rounded-xl border border-white/10 bg-black/40 text-[12px] text-white/45">
              Preparing upload...
            </div>
          )
        )}

        {activeMode === "upload" && <NexusMemoryUpload onDone={() => setActiveMode("talk")} />}

        {activeMode === "doc" && <ResearchDocuments />}

        {activeMode === "draw" && (
          <NexusDrawCanvas
            ensureConversationId={conversationController.ensureUploadConversation}
            onSent={(result) => {
              conversationController.handleFileUpload(undefined, result);
              setActiveMode("talk");
            }}
          />
        )}

        {activeMode === "browse" && <NexusLiveBrowser />}

        {activeMode === "history" && (
          <div className="max-h-[220px] overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2">
            {conversations.length === 0 ? (
              <p className="p-3 text-center text-[12px] text-white/40">No conversations yet.</p>
            ) : (
              <div className="space-y-1">
                {conversations.slice(0, 12).map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => goToChat(conversation.id)}
                    className={cn(
                      "block w-full truncate rounded-lg px-3 py-2 text-left text-[13px] transition",
                      activeConversationId === conversation.id
                        ? "bg-cyan-200/10 text-cyan-50"
                        : "text-white/70 hover:bg-white/5",
                    )}
                  >
                    {conversation.title || "Conversation"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setActiveMode((value) => (value === "browse" ? "talk" : "browse"))}
          aria-pressed={activeMode === "browse"}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] transition",
            activeMode === "browse"
              ? "border-cyan-200/35 bg-cyan-200/[0.1] text-cyan-50"
              : "border-white/10 bg-black/40 text-white/70 hover:bg-white/5",
          )}
        >
          <Globe size={14} /> Browse
        </button>
        <button
          type="button"
          onClick={() => setActiveMode((value) => (value === "history" ? "talk" : "history"))}
          aria-pressed={activeMode === "history"}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] transition",
            activeMode === "history"
              ? "border-cyan-200/35 bg-cyan-200/[0.1] text-cyan-50"
              : "border-white/10 bg-black/40 text-white/70 hover:bg-white/5",
          )}
        >
          <Clock size={14} /> History
        </button>
      </div>
    </section>
  );
}

function CommunicationModeButton({
  mode,
  active,
  onSelect,
}: {
  readonly mode: NexusCommunicationModeView;
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  const Icon = iconForMode(mode.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!mode.enabled}
      aria-pressed={active}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1 text-white/58 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none",
        active && mode.enabled && "text-cyan-200",
        !mode.enabled && "cursor-not-allowed opacity-35 hover:text-white/58",
      )}
      title={mode.label}
      aria-label={`${mode.label} communication`}
    >
      <Icon size={17} />
      <span className="max-w-[52px] truncate text-[9px] font-medium">{mode.label}</span>
    </button>
  );
}

export function iconForMode(modeId: string) {
  switch (modeId) {
    case "talk":
      return Mic;
    case "image":
      return Image;
    case "draw":
      return PenTool;
    case "doc":
      return FileText;
    case "upload":
      return Upload;
    case "text":
    default:
      return MessageCircle;
  }
}
