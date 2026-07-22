import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Image, MessageCircle, Mic, PenTool, Upload } from "lucide-react";
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
import { NexusConversationRuntime } from "./communication/NexusConversationRuntime";
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
    onBeforeSend: handleBeforeSend,
    onAgentResponse: handleAgentResponse,
    onConversationIdChange: setActiveConversationId,
  });

  return (
    <section
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.09] border-t-white/[0.14] bg-gradient-to-b from-indigo-300/[0.05] via-black/30 to-black/45 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl sm:p-4"
      aria-label="Persistent ZAR communication"
    >
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 motion-safe:animate-[nexus-pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
          ZAR
        </span>
        {status !== "Ready" && (
          <span className="truncate text-[12px] text-white/55">{status}</span>
        )}
      </div>

      <div className="mb-2.5 shrink-0">
        <div className="flex items-center justify-around gap-1" aria-label={`${focusedLabel} communication modes`}>
          {modes.map((mode) => (
            <CommunicationModeButton
              key={mode.id}
              mode={mode}
              onSelect={() => {
                const result = applyClientAction({ type: "open-communication", modeId: mode.id });
                if (!result.accepted) setStatus(`${mode.label} is not available yet`);
              }}
            />
          ))}
        </div>
      </div>

      {conversations.length > 0 && (
        <div className="mb-3 flex shrink-0 gap-2 overflow-x-auto pb-1" aria-label="Recent conversations">
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
        <div className="mb-3 flex shrink-0 gap-2 overflow-x-auto pb-1" aria-label="Project context">
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

      <NexusConversationRuntime controller={conversationController} />

      <NexusVoiceDock
        onTranscript={conversationController.setComposerValue}
        isResponding={conversationController.isStreaming}
      />
    </section>
  );
}

function CommunicationModeButton({
  mode,
  onSelect,
}: {
  readonly mode: NexusCommunicationModeView;
  readonly onSelect: () => void;
}) {
  const Icon = iconForMode(mode.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!mode.enabled}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1 text-white/58 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none",
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
