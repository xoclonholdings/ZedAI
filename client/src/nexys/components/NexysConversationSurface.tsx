import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, Clock, File, FileText, Image, Lightbulb, MessageCircle, Mic, Search, Smartphone, Upload } from "lucide-react";
import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import type { Conversation } from "@shared/schema";
import {
  EXTRACTABLE_UPLOAD_ACCEPT,
  EXTRACTABLE_UPLOAD_MIME_TYPES,
  IMAGE_UPLOAD_ACCEPT,
  IMAGE_UPLOAD_MIME_TYPES,
} from "@shared/upload-policy";
import {
  NEXYS_DOCK_CONTROLS,
  type NexysDockControlDefinition,
  type NexysDockControlId,
} from "../dock/nexysDock";
import { useNexysChatSession } from "../communication/useNexysChatSession";
import { submitVoiceCommandThroughConversation } from "../communication/foregroundVoice";
import { useNexysForegroundVoice } from "../communication/useNexysDictation";
import { NexysFileUpload } from "./communication/NexysFileUpload";
import { NexysVoiceDock } from "./communication/NexysVoiceDock";
import { NexysSmsSettings } from "./communication/NexysSmsSettings";
import { useNexys } from "../state/NexysProvider";

/**
 * The five approved NEXYS controls. Chat and Upload open branching choices
 * inside the existing fixed content slot; Ideas, Task, and Search enter their
 * real Operate surfaces. History remains a Console option outside this count.
 */
export type NexysDockMode = NexysDockControlId;
type NexysDockSlot = NexysDockMode | "talk" | "sms" | "attachment" | "history";
type UploadKind = "image" | "document" | "file";

const DOCUMENT_UPLOAD_ACCEPT = ".txt,.md,.pdf,.docx";
const DOCUMENT_UPLOAD_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export function NexysConversationSurface({
  initialMode,
}: {
  /** Which control to open with when the compact Console dock powers on. */
  readonly initialMode?: NexysDockMode;
} = {}) {
  const [, navigate] = useLocation();
  const { viewportSnapshot } = useNexys();
  const [activeMode, setActiveMode] = useState<NexysDockSlot>(initialMode ?? "chat");
  const [uploadKind, setUploadKind] = useState<UploadKind | null>(null);

  const goToChat = useCallback((conversationId?: string) => {
    navigate(conversationId ? `/chat/${conversationId}` : "/chat");
  }, [navigate]);

  const { controller: conversationController, activeConversationId, status } = useNexysChatSession(undefined, {
    onModeAction: (modeId) => handleModeSelect(modeId),
  });

  const focusedLabel = viewportSnapshot.focusedNode?.label ?? "Nexys";
  // Workspace selection subtly tints the console's accent (spec: "may influence
  // accent colors ... contextual controls"); the surface itself stays persistent.
  const accentColor = viewportSnapshot.focusedNode?.metadata.visual.color ?? "#22d3ee";

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 30000,
  });

  // Owned here (not inside NexysVoiceDock) so the Talk mode and microphone
  // control one foreground voice session. Every recognized command uses the
  // exact authenticated conversation controller used by written Nexys chat.
  const voice = useNexysForegroundVoice({
    submitCommand: (command) => submitVoiceCommandThroughConversation(conversationController, command),
    cancelSubmission: conversationController.abort,
  });

  function handleModeSelect(modeId: string) {
    if (modeId === "talk") {
      openTalk();
      return;
    }
    if (modeId === "text") {
      openSms();
      return;
    }
    if (modeId === "image" || modeId === "doc") {
      openUpload(modeId === "image" ? "image" : "document");
      return;
    }

    const control = NEXYS_DOCK_CONTROLS.find((candidate) => candidate.id === modeId);
    if (!control) return;

    if (modeId === "chat") {
      conversationController.closeFileUpload();
      setActiveMode("chat");
      return;
    }
    if (modeId === "upload") {
      conversationController.closeFileUpload();
      setUploadKind(null);
      setActiveMode("upload");
      return;
    }
    if (control.route) navigate(control.route);
  }

  function openTalk() {
    setActiveMode("talk");
    voice.toggle();
  }

  function openSms() {
    setActiveMode("sms");
  }

  function openUpload(kind: UploadKind) {
    setUploadKind(kind);
    setActiveMode("attachment");
    void conversationController.openFileUpload();
  }

  function closeAttachment() {
    conversationController.closeFileUpload();
    setUploadKind(null);
    setActiveMode("upload");
  }

  return (
    <section
      className="relative flex w-full flex-col overflow-hidden border border-b-0 border-indigo-400/25 bg-gradient-to-b from-[#0d0a1f] via-[#0a0718] to-[#070512] px-4 pb-3 pt-3 shadow-[0_-10px_60px_-15px_rgba(99,102,241,0.45)] backdrop-blur-2xl transition-colors duration-500 sm:px-5 sm:pb-4"
      style={{
        borderColor: `${accentColor}40`,
        clipPath: "polygon(0 22px, 7% 22px, 10% 0, 90% 0, 93% 22px, 100% 22px, 100% 100%, 0 100%)",
      }}
      aria-label="Persistent NEXYS communication"
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
          className="h-1.5 w-1.5 shrink-0 rounded-full motion-safe:animate-[nexys-pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
          NΞXYS
        </span>
        <span className="text-[11px] text-emerald-400">&middot; Online</span>
        {status !== "Ready" && (
          <span className="truncate text-[12px] text-white/55">{status}</span>
        )}
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-black/40 px-2 py-1.5">
        <div className="flex items-center justify-around gap-1" aria-label={`${focusedLabel} dock controls`}>
          {NEXYS_DOCK_CONTROLS.map((control) => (
            <DockControlButton
              key={control.id}
              control={control}
              active={activeMode === control.id}
              onSelect={() => handleModeSelect(control.id)}
            />
          ))}
        </div>
      </div>

      {/*
        The one content slot. Chat contains ZAR's communication modes and
        Upload contains the approved intake split. The fixed Console layout
        remains unchanged around it.
      */}
      <div className="mb-3 flex min-h-[101px] flex-col justify-center">
        {activeMode === "chat" && (
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-black/40 p-3">
            <SlotChoice icon={MessageCircle} label="Chat" onSelect={() => goToChat(activeConversationId)} />
            <SlotChoice icon={Mic} label="Talk" onSelect={openTalk} />
            <SlotChoice icon={Smartphone} label="SMS" onSelect={openSms} />
          </div>
        )}

        {activeMode === "sms" && <NexysSmsSettings />}

        {activeMode === "talk" && (
          <NexysVoiceDock voice={voice} />
        )}

        {activeMode === "upload" && (
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-black/40 p-3">
            <SlotChoice icon={Image} label="Image" onSelect={() => openUpload("image")} />
            <SlotChoice icon={FileText} label="Document" onSelect={() => openUpload("document")} />
            <SlotChoice icon={File} label="File" onSelect={() => openUpload("file")} />
          </div>
        )}

        {activeMode === "attachment" && uploadKind && (
          conversationController.showFileUpload && conversationController.activeUploadConversationId ? (
            <NexysFileUpload
              conversationId={conversationController.activeUploadConversationId}
              onUpload={conversationController.handleFileUpload}
              onClose={closeAttachment}
              accept={uploadAcceptFor(uploadKind)}
              allowedTypes={uploadTypesFor(uploadKind)}
              label={`Tap to upload ${uploadKind === "file" ? "a file" : `a${uploadKind === "image" ? "n" : ""} ${uploadKind}`}`}
            />
          ) : (
            <div className="flex h-[104px] items-center justify-center rounded-xl border border-white/10 bg-black/40 text-[12px] text-white/45">
              Preparing upload...
            </div>
          )
        )}

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

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setActiveMode((value) => (value === "history" ? "chat" : "history"))}
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

function DockControlButton({
  control,
  active,
  onSelect,
}: {
  readonly control: NexysDockControlDefinition;
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  const Icon = iconForMode(control.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1 text-white/58 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none",
        active && "text-cyan-200",
      )}
      title={control.label}
      aria-label={control.label}
    >
      <Icon size={17} />
      <span className="max-w-[52px] truncate text-[9px] font-medium">{control.label}</span>
    </button>
  );
}

function SlotChoice({
  icon: Icon,
  label,
  onSelect,
}: {
  readonly icon: typeof MessageCircle;
  readonly label: string;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 text-[11px] font-medium text-white/70 transition hover:border-cyan-200/25 hover:bg-white/5 hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
    >
      <Icon size={18} />
      {label}
    </button>
  );
}

function uploadAcceptFor(kind: UploadKind): string {
  if (kind === "image") return IMAGE_UPLOAD_ACCEPT;
  if (kind === "document") return DOCUMENT_UPLOAD_ACCEPT;
  return EXTRACTABLE_UPLOAD_ACCEPT;
}

function uploadTypesFor(kind: UploadKind): readonly string[] {
  if (kind === "image") return IMAGE_UPLOAD_MIME_TYPES;
  if (kind === "document") return DOCUMENT_UPLOAD_MIME_TYPES;
  return EXTRACTABLE_UPLOAD_MIME_TYPES;
}

export function iconForMode(modeId: string) {
  switch (modeId) {
    case "chat":
      return MessageCircle;
    case "upload":
      return Upload;
    case "ideas":
      return Lightbulb;
    case "task":
      return CheckSquare;
    case "search":
      return Search;
    default:
      return MessageCircle;
  }
}
