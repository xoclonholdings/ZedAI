import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  extractNexusClientActions,
  resolveDeterministicNexusClientAction,
  resolveNexusClientAction,
  type NexusClientAction,
} from "../actions/NexusClientActions";
import { NexusAdaptiveComposer } from "./communication/NexusAdaptiveComposer";
import { NexusConversationRuntime } from "./communication/NexusConversationRuntime";
import { routeForNexusNode } from "../graph/rootConstellation";
import { useNexus } from "../state/NexusProvider";
import type { NexusCommunicationModeId } from "../communication/types";
import { communicationModeViews } from "../viewport/NexusViewportModel";

export interface NexusConversationSurfaceProps {
  readonly conversationId?: string | null;
  /**
   * portal — the near-empty landing dock: mode-adaptive composer only,
   * no history, no chips. full — the opened communication room.
   */
  readonly variant?: "portal" | "full";
}

export function NexusConversationSurface({ conversationId, variant = "full" }: NexusConversationSurfaceProps) {
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
  const [activeMode, setActiveMode] = useState<NexusCommunicationModeId>("text");
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

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 30000,
    enabled: variant === "full",
  });

  const { data: projects = [], refetch: refetchProjects } = useQuery<FilingProject[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      return data.projects || [];
    },
    enabled: variant === "full",
  });

  const { data: currentConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", activeConversationId],
    enabled: !!activeConversationId,
  });

  const { data: messages = [] } = useQuery<Message[]>({
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
      setActiveMode(action.modeId as NexusCommunicationModeId);
      navigate(result.resolution.route);
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

  function openConversation(id: string) {
    setActiveConversationId(id);
    navigate(`/chat/${id}`);
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
    nexusFocus: viewportSnapshot.focusedNode?.id ?? null,
    onBeforeSend: handleBeforeSend,
    onAgentResponse: handleAgentResponse,
    onConversationIdChange: setActiveConversationId,
  });

  const adaptiveComposer = (
    <NexusAdaptiveComposer
      modes={modes}
      activeMode={activeMode}
      onModeChange={setActiveMode}
      composerValue={conversationController.composerValue}
      onComposerValueChange={conversationController.setComposerValue}
      onSend={(message) => void conversationController.sendMessage(message)}
      onAbort={conversationController.abort}
      isStreaming={conversationController.isStreaming}
      onOpenFileUpload={() => void conversationController.openFileUpload()}
      editModeLabel={conversationController.editingMessageId ? "Editing message draft" : null}
      onCancelEdit={conversationController.editingMessageId ? conversationController.cancelEdit : undefined}
      ensureUploadConversationId={conversationController.ensureUploadConversationId}
      onUploaded={(uploadedFiles, result) => conversationController.handleFileUpload(uploadedFiles, result)}
    />
  );

  // Portal: the doorway, not the room. One adaptive composer, nothing else.
  if (variant === "portal") {
    return (
      <section
        className="rounded-2xl border border-white/[0.08] bg-black/55 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-4"
        aria-label="Talk to ZAR"
      >
        {adaptiveComposer}
        {conversationController.runtimeError ? (
          <div className="mt-2 rounded-xl border border-red-300/20 bg-red-500/[0.08] px-3 py-2 text-sm text-red-100">
            {conversationController.runtimeError}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-black/55 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-4"
      aria-label="Persistent ZAR communication"
    >
      <div className="mb-3 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
          ZAR
        </div>
        <div className="truncate text-sm text-white/70">
          {status} - Focused on {focusedLabel}
        </div>
      </div>

      {conversations.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Recent conversations">
          {conversations.slice(0, 6).map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => openConversation(conversation.id)}
              className={cn(
                "max-w-[220px] shrink-0 truncate rounded-full border px-3 py-1.5 text-[12px] transition",
                activeConversationId === conversation.id
                  ? "border-cyan-200/35 bg-cyan-200/[0.1] text-cyan-50"
                  : "border-white/[0.08] bg-white/[0.035] text-white/58 hover:border-white/18 hover:text-white",
              )}
            >
              {conversation.title || "Conversation"}
            </button>
          ))}
        </div>
      )}

      {projects.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Project context">
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
          {projects.slice(0, 6).map((project) => (
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
          ))}
        </div>
      )}

      <NexusConversationRuntime controller={conversationController} composer={adaptiveComposer} />
    </section>
  );
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
