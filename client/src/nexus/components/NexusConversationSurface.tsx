import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, FileText, Image, Layers, MessageCircle, Mic, PenTool, Upload } from "lucide-react";
import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import { useLocationSearch } from "@/lib/useLocationSearch";
import {
  persistWorkspace,
  resolveWorkspace,
  WORKSPACE_AGENT,
  WORKSPACE_LABEL,
  type WorkspaceSlug,
} from "@/lib/workspaceContext";
import type { AgentTarget, Conversation, Message, File as DBFile } from "@shared/schema";
import type { FilingProject } from "@/types/conversation";
import { useNexusConversationController } from "../communication/useNexusConversationController";
import { useNexusDictation } from "../communication/useNexusDictation";
import {
  extractNexusClientActions,
  resolveDeterministicNexusClientAction,
  resolveNexusClientAction,
  type NexusClientAction,
} from "../actions/NexusClientActions";
import { NexusFileUpload } from "./communication/NexusFileUpload";
import { NexusMessageComposer } from "./communication/NexusMessageComposer";
import { NexusVoiceDock } from "./communication/NexusVoiceDock";
import { routeForNexusNode } from "../graph/rootConstellation";
import { useNexus } from "../state/NexusProvider";
import {
  communicationModeViews,
  type NexusCommunicationModeView,
} from "../viewport/NexusViewportModel";

export interface NexusConversationSurfaceProps {
  readonly conversationId?: string | null;
}

/** Stable identity so a data-less query doesn't feed a new [] into effects every render. */
const EMPTY_MESSAGES: Message[] = [];

/**
 * What's showing in the console's one content slot, where the mic sits by
 * default - Text/Talk/Image/Doc/Upload/History/Memory Context all just swap
 * this slot's content. The dock around it (status row, mode row, this slot,
 * History/Memory row) never changes shape or grows - only the slot's
 * content changes.
 */
type NexusDockMode = "talk" | "text" | "image" | "doc" | "upload" | "history" | "memory";

export function NexusConversationSurface({ conversationId }: NexusConversationSurfaceProps) {
  const [, navigate] = useLocation();
  const {
    capabilityRegistry,
    communicationLayer,
    navigateToNode,
    snapshot,
    viewportSnapshot,
  } = useNexus();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(
    normalizeConversationId(conversationId),
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready");
  // A deep link into a specific conversation opens straight to its composer;
  // otherwise the mic is the default slot content.
  const [activeMode, setActiveMode] = useState<NexusDockMode>(
    () => (normalizeConversationId(conversationId) ? "text" : "talk"),
  );
  const search = useLocationSearch();
  const workspaceSlug = useMemo<WorkspaceSlug | null>(
    () => resolveWorkspace(search),
    [search],
  );
  const learningContext = useMemo(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return {
      learningPathId: params.get("learningPathId") || params.get("learningPath"),
      lessonId: params.get("lessonId") || params.get("lesson"),
    };
  }, [search]);

  useEffect(() => {
    setActiveConversationId(normalizeConversationId(conversationId));
  }, [conversationId]);

  useEffect(() => {
    if (workspaceSlug) persistWorkspace(workspaceSlug);
  }, [workspaceSlug]);

  const workspaceContext: AgentTarget | undefined = workspaceSlug
    ? WORKSPACE_AGENT[workspaceSlug]
    : undefined;
  const workspaceLabel = workspaceSlug ? WORKSPACE_LABEL[workspaceSlug] : null;
  const modes = useMemo(() => communicationModeViews(communicationLayer), [communicationLayer]);
  const focusedLabel = viewportSnapshot.focusedNode?.label ?? "Nexus";
  // Workspace selection subtly tints the console's accent (spec: "may influence
  // accent colors ... contextual controls"); the surface itself stays persistent.
  const accentColor = viewportSnapshot.focusedNode?.metadata.visual.color ?? "#22d3ee";

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 30000,
  });

  const { data: projects = [], refetch: refetchProjects } = useQuery<FilingProject[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      return data.projects || [];
    },
  });

  const { data: currentConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", activeConversationId],
    enabled: !!activeConversationId,
  });

  const { data: messages = EMPTY_MESSAGES } = useQuery<Message[]>({
    queryKey: ["/api/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
    refetchInterval: 5000,
  });

  const { data: files = [] } = useQuery<DBFile[]>({
    queryKey: ["/api/conversations", activeConversationId, "files"],
    enabled: !!activeConversationId,
  });

  const applyClientAction = useCallback((action: NexusClientAction) => {
    const result = resolveNexusClientAction(action, snapshot, capabilityRegistry, communicationLayer);
    if (!result.accepted) {
      console.warn("[Nexus] Ignored client action", { reasonCode: result.reasonCode, action });
      setStatus("Ignored an unavailable Nexus action");
      return result;
    }

    if (action.type === "focus-node" && result.resolution?.nodeId) {
      navigateToNode(result.resolution.nodeId, "zar");
      navigate(result.resolution.route);
      setStatus(`Focused ${result.resolution.label}`);
      return result;
    }

    if (action.type === "open-capability" && result.resolution) {
      if (result.resolution.nodeId) {
        navigateToNode(result.resolution.nodeId, "zar");
      }
      navigate(result.resolution.route);
      setStatus(`Opened ${result.resolution.label}`);
      return result;
    }

    if (action.type === "open-communication" && result.resolution) {
      handleModeSelect(action.modeId);
      setStatus(`Opened ${result.resolution.label}`);
      return result;
    }

    if (action.type === "navigate-route") {
      navigate(action.route);
      setStatus("Navigation updated");
      return result;
    }

    return result;
  }, [capabilityRegistry, communicationLayer, navigate, navigateToNode, snapshot]);

  const handleBeforeSend = useCallback((message: string) => {
    const exactAction = resolveDeterministicNexusClientAction(
      message,
      snapshot,
      capabilityRegistry,
      communicationLayer,
    );
    if (!exactAction) return false;

    const result = applyClientAction(exactAction);
    return result.accepted;
  }, [applyClientAction, capabilityRegistry, communicationLayer, snapshot]);

  const handleAgentResponse = useCallback((data: unknown) => {
    const actions = extractNexusClientActions(data);
    if (actions.length === 0) return;
    for (const action of actions) applyClientAction(action);
  }, [applyClientAction]);

  async function handleAssignProject(conversationIdToAssign: string, projectId: string | null) {
    const response = await fetch(`/api/conversations/${conversationIdToAssign}/project`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId }),
    });

    if (response.ok) {
      setSelectedProjectId(projectId);
      await refetchProjects();
    }
  }

  const conversationController = useNexusConversationController({
    conversation: currentConversation,
    messages,
    files,
    conversationId: activeConversationId,
    selectedProjectId,
    workspaceContext,
    workspaceLabel,
    workspaceSlug,
    learningPathId: learningContext.learningPathId,
    lessonId: learningContext.lessonId,
    onBeforeSend: handleBeforeSend,
    onAgentResponse: handleAgentResponse,
    onConversationIdChange: setActiveConversationId,
  });

  // Owned here (not inside NexusVoiceDock) so the "Talk" mode button below
  // can trigger the exact same dictation toggle as the persistent mic button.
  const dictation = useNexusDictation((text) => {
    conversationController.setComposerValue(text);
    setActiveMode("text");
  });

  // Each mode button performs the real action it names, in the console's own
  // one content slot, using the console's real surfaces (composer, dictation,
  // file upload) - never navigating anywhere, since the dock is a persistent
  // overlay, not a page of its own.
  function handleModeSelect(modeId: string) {
    switch (modeId) {
      case "text":
        setActiveMode("text");
        return;
      case "talk":
        dictation.toggle();
        setActiveMode("talk");
        return;
      case "image":
      case "doc":
      case "upload":
        setActiveMode(modeId);
        void conversationController.openFileUpload();
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
      aria-label="Persistent ZAR communication"
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
          ZAR
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

        {activeMode === "text" && (
          <NexusMessageComposer
            value={conversationController.composerValue}
            onValueChange={conversationController.setComposerValue}
            onSend={(message) => void conversationController.sendMessage(message)}
            onAbort={conversationController.abort}
            isStreaming={conversationController.isStreaming}
            onOpenFileUpload={() => {
              setActiveMode("upload");
              void conversationController.openFileUpload();
            }}
            editModeLabel={conversationController.editingMessageId ? "Editing message draft" : null}
            onCancelEdit={conversationController.editingMessageId ? conversationController.cancelEdit : undefined}
          />
        )}

        {(activeMode === "image" || activeMode === "doc" || activeMode === "upload") && (
          conversationController.showFileUpload && conversationController.activeUploadConversationId ? (
            <NexusFileUpload
              conversationId={conversationController.activeUploadConversationId}
              onUpload={conversationController.handleFileUpload}
              onClose={() => setActiveMode("talk")}
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
                    onClick={() => {
                      setActiveConversationId(conversation.id);
                      setActiveMode("text");
                    }}
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

        {activeMode === "memory" && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/40 p-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId(null);
                if (activeConversationId) void handleAssignProject(activeConversationId, null);
              }}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition",
                selectedProjectId === null
                  ? "border-white/22 bg-white/[0.08] text-white"
                  : "border-white/[0.08] bg-white/[0.03] text-white/52 hover:text-white",
              )}
            >
              All context
            </button>
            {projects.length === 0 ? (
              <span className="px-1 py-1.5 text-[12px] text-white/40">No projects yet.</span>
            ) : (
              projects.slice(0, 6).map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    if (activeConversationId) void handleAssignProject(activeConversationId, project.id);
                  }}
                  className={cn(
                    "max-w-[180px] shrink-0 truncate rounded-full border px-3 py-1.5 text-[12px] transition",
                    selectedProjectId === project.id
                      ? "border-amber-200/35 bg-amber-200/[0.1] text-amber-50"
                      : "border-white/[0.08] bg-white/[0.03] text-white/52 hover:text-white",
                  )}
                >
                  {project.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
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
        <button
          type="button"
          onClick={() => setActiveMode((value) => (value === "memory" ? "talk" : "memory"))}
          aria-pressed={activeMode === "memory"}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] transition",
            activeMode === "memory"
              ? "border-amber-200/35 bg-amber-200/[0.1] text-amber-50"
              : "border-white/10 bg-black/40 text-white/70 hover:bg-white/5",
          )}
        >
          Memory Context <Layers size={14} />
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

function iconForMode(modeId: string) {
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

function normalizeConversationId(value: string | null | undefined): string | undefined {
  if (!value || value === "undefined" || value === "null") return undefined;
  return value;
}

export function routeForNexusClientAction(action: NexusClientAction): string | null {
  if (action.type === "focus-node") return routeForNexusNode(action.nodeId);
  if (action.type === "navigate-route") return action.route;
  return null;
}
