import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

import { useLocationSearch } from "@/lib/useLocationSearch";
import {
  persistWorkspace,
  resolveWorkspace,
  WORKSPACE_AGENT,
  WORKSPACE_LABEL,
  type WorkspaceSlug,
} from "@/lib/workspaceContext";
import type { AgentTarget, Conversation, Message, File as DBFile } from "@shared/schema";
import { useNexysConversationController, type NexysConversationController } from "./useNexysConversationController";
import {
  extractNexysClientActions,
  resolveDeterministicNexysClientAction,
  resolveNexysClientAction,
  type NexysClientAction,
} from "../actions/NexysClientActions";
import { useNexys } from "../state/NexysProvider";

const EMPTY_MESSAGES: Message[] = [];

function normalizeConversationId(value: string | null | undefined): string | undefined {
  if (!value || value === "undefined" || value === "null") return undefined;
  return value;
}

/**
 * Everything a real ZAR conversation surface needs - workspace/learning
 * context resolution, the real conversation/message/file queries, and the
 * client-action resolution that lets ZAR's own responses drive real Nexys
 * navigation. Shared between the console's inline composer and the full
 * chat page so neither has to duplicate this, and so agent-driven actions
 * behave identically in both places.
 */
export function useNexysChatSession(conversationId?: string | null, options?: { onModeAction?: (modeId: string) => void }) {
  const [, navigate] = useLocation();
  const { capabilityRegistry, communicationLayer, navigateToNode, snapshot } = useNexys();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(
    normalizeConversationId(conversationId),
  );
  const [status, setStatus] = useState("Ready");
  const search = useLocationSearch();

  const workspaceSlug = useMemo<WorkspaceSlug | null>(() => resolveWorkspace(search), [search]);
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

  const workspaceContext: AgentTarget | undefined = workspaceSlug ? WORKSPACE_AGENT[workspaceSlug] : undefined;
  const workspaceLabel = workspaceSlug ? WORKSPACE_LABEL[workspaceSlug] : null;

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

  const applyClientAction = useCallback((action: NexysClientAction) => {
    const result = resolveNexysClientAction(action, snapshot, capabilityRegistry, communicationLayer);
    if (!result.accepted) {
      console.warn("[Nexys] Ignored client action", { reasonCode: result.reasonCode, action });
      setStatus("Ignored an unavailable Nexys action");
      return result;
    }

    if (action.type === "focus-node" && result.resolution?.nodeId) {
      navigateToNode(result.resolution.nodeId, "zar");
      navigate(result.resolution.route);
      setStatus(`Focused ${result.resolution.label}`);
      return result;
    }

    if (action.type === "open-capability" && result.resolution) {
      if (result.resolution.nodeId) navigateToNode(result.resolution.nodeId, "zar");
      navigate(result.resolution.route);
      setStatus(`Opened ${result.resolution.label}`);
      return result;
    }

    if (action.type === "open-communication" && result.resolution) {
      options?.onModeAction?.(action.modeId);
      setStatus(`Opened ${result.resolution.label}`);
      return result;
    }

    if (action.type === "navigate-route") {
      navigate(action.route);
      setStatus("Navigation updated");
      return result;
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilityRegistry, communicationLayer, navigate, navigateToNode, snapshot, options?.onModeAction]);

  const handleBeforeSend = useCallback((message: string) => {
    const exactAction = resolveDeterministicNexysClientAction(message, snapshot, capabilityRegistry, communicationLayer);
    if (!exactAction) return false;
    return applyClientAction(exactAction).accepted;
  }, [applyClientAction, capabilityRegistry, communicationLayer, snapshot]);

  const handleAgentResponse = useCallback((data: unknown) => {
    const actions = extractNexysClientActions(data);
    if (actions.length === 0) return;
    for (const action of actions) applyClientAction(action);
  }, [applyClientAction]);

  const controller: NexysConversationController = useNexysConversationController({
    conversation: currentConversation,
    messages,
    files,
    conversationId: activeConversationId,
    workspaceContext,
    workspaceLabel,
    workspaceSlug,
    learningPathId: learningContext.learningPathId,
    lessonId: learningContext.lessonId,
    onBeforeSend: handleBeforeSend,
    onAgentResponse: handleAgentResponse,
    onConversationIdChange: setActiveConversationId,
  });

  return { controller, activeConversationId, setActiveConversationId, status };
}
