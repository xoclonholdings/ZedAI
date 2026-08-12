import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarClock, Check, CheckSquare, Clock, File, FileText, Image, Lightbulb, MessageCircle, Mic, Search, Send, Smartphone, Upload, User, X, Zap } from "lucide-react";
import { useLocation } from "wouter";

import { apiRequest } from "@/lib/queryClient";
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
import { useNexysConsoleChat } from "../communication/NexysConsoleChatContext";
import { submitVoiceCommandThroughConversation } from "../communication/foregroundVoice";
import { useNexysForegroundVoice } from "../communication/useNexysDictation";
import { NexysFileUpload } from "./communication/NexysFileUpload";
import { NexysMessageComposer } from "./communication/NexysMessageComposer";
import { NexysVoiceDock } from "./communication/NexysVoiceDock";
import { NexysSmsSettings } from "./communication/NexysSmsSettings";
import { useNexys } from "../state/NexysProvider";
import { useNexysDockAttention } from "../notifications/NexysDockAttentionContext";
import { useConsoleBrowser } from "@/console/ConsoleBrowserContext";
import { NexysLiveBrowser } from "./communication/NexysLiveBrowser";
import {
  TASKS_QUERY_KEY,
  type Assignee,
  type TaskRecord,
  type TasksResponse,
} from "@/pages/tasks";

/**
 * The five approved NEXYS controls. Chat and Upload open branching choices
 * inside the existing fixed content slot; Ideas, Task, and Search enter their
 * real Operate surfaces. History remains a Console option outside this count.
 */
export type NexysDockMode = NexysDockControlId;
type NexysDockSlot = NexysDockMode | "talk" | "sms" | "attachment" | "history";
type UploadKind = "image" | "document" | "file";

const IDEAS_QUERY_KEY = ["/api/knowledge/scratchpad"];
const IDEA_LIMIT = 280;
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
  const { openFullPage, closeFullPage } = useConsoleBrowser();
  const { hasAttention, acknowledgeReviewOnly } = useNexysDockAttention();
  const [activeMode, setActiveMode] = useState<NexysDockSlot>(initialMode ?? "chat");
  const initialModeHandled = useRef(false);
  const [uploadKind, setUploadKind] = useState<UploadKind | null>(null);
  const {
    controller: conversationController,
    activeConversationId,
    status,
    registerModeAction,
  } = useNexysConsoleChat();

  const goToChat = useCallback((conversationId?: string) => {
    navigate(conversationId ? `/chat/${conversationId}` : "/chat");
  }, [navigate]);

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

  useEffect(() => {
    if (initialModeHandled.current) return;
    initialModeHandled.current = true;
    if (initialMode === "chat") void conversationController.startConversation();
  }, [conversationController, initialMode]);

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
    void acknowledgeReviewOnly(control.id);

    if (modeId === "chat") {
      conversationController.closeFileUpload();
      setActiveMode("chat");
      closeFullPage();
      void conversationController.startConversation();
      return;
    }
    if (modeId === "upload") {
      conversationController.closeFileUpload();
      setUploadKind(null);
      setActiveMode("upload");
      return;
    }
    if (modeId === "search") {
      conversationController.closeFileUpload();
      setUploadKind(null);
      setActiveMode("search");
      openFullPage();
      if (control.route) navigate(control.route);
      return;
    }
    if (modeId === "ideas") {
      conversationController.closeFileUpload();
      setUploadKind(null);
      setActiveMode("ideas");
      closeFullPage();
      if (control.route) navigate(control.route);
      return;
    }
    if (modeId === "task") {
      conversationController.closeFileUpload();
      setUploadKind(null);
      setActiveMode("task");
      closeFullPage();
      if (control.route) navigate(control.route);
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
  }

  function closeAttachment() {
    conversationController.closeFileUpload();
    setUploadKind(null);
    setActiveMode("upload");
  }

  useEffect(() => registerModeAction(handleModeSelect));

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
              attention={hasAttention(control.id)}
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
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <NexysMessageComposer
              value={conversationController.composerValue}
              onValueChange={conversationController.setComposerValue}
              onSend={(message) => void conversationController.sendMessage(message)}
              onAbort={conversationController.abort}
              isStreaming={conversationController.isStreaming}
              onOpenFileUpload={() => handleModeSelect("upload")}
              editModeLabel={conversationController.editingMessageId ? "Editing message draft" : null}
              onCancelEdit={conversationController.editingMessageId ? conversationController.cancelEdit : undefined}
              compact={conversationController.compactMessages}
              fontSize={conversationController.fontSize}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SlotChoice icon={Mic} label="Talk" onSelect={openTalk} />
              <SlotChoice icon={Smartphone} label="SMS" onSelect={openSms} />
            </div>
          </div>
        )}

        {activeMode === "sms" && <NexysSmsSettings />}

        {activeMode === "talk" && (
          <NexysVoiceDock voice={voice} />
        )}

        {activeMode === "upload" && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/40 p-3">
            <SlotChoice icon={Image} label="Image" onSelect={() => openUpload("image")} />
            <SlotChoice icon={FileText} label="Document" onSelect={() => openUpload("document")} />
            <SlotChoice icon={File} label="File" onSelect={() => openUpload("file")} />
            <SlotChoice icon={BookOpen} label="Add knowledge" onSelect={() => navigate("/knowledge?add=1")} />
          </div>
        )}

        {activeMode === "ideas" && <NexysIdeaComposer />}

        {activeMode === "task" && <NexysTaskComposer />}

        {activeMode === "search" && <NexysLiveBrowser />}

        {activeMode === "attachment" && uploadKind && (
          <NexysFileUpload
            conversationId={conversationController.activeUploadConversationId}
            ensureConversation={conversationController.ensureUploadConversation}
            onUpload={conversationController.handleFileUpload}
            onClose={closeAttachment}
            accept={uploadAcceptFor(uploadKind)}
            allowedTypes={uploadTypesFor(uploadKind)}
            label={`Tap to upload ${uploadKind === "file" ? "a file" : `a${uploadKind === "image" ? "n" : ""} ${uploadKind}`}`}
          />
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

function NexysIdeaComposer() {
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();
  const createIdea = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/knowledge/scratchpad", {
        content: draft.trim(),
        tags: ["idea"],
      });
      return response.json();
    },
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: IDEAS_QUERY_KEY });
    },
  });

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value.slice(0, IDEA_LIMIT))}
        rows={3}
        maxLength={IDEA_LIMIT}
        placeholder="Drop an idea..."
        aria-label="Idea input"
        className="w-full resize-none bg-transparent text-sm leading-6 text-white placeholder:text-white/30 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-white/35">{draft.length}/{IDEA_LIMIT}</span>
        <button
          type="button"
          onClick={() => createIdea.mutate()}
          disabled={!draft.trim() || createIdea.isPending}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-black transition hover:bg-cyan-200 disabled:opacity-35"
          aria-label="Save idea"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function NexysTaskComposer() {
  const [draft, setDraft] = useState("");
  const [assignee, setAssignee] = useState<Assignee>("user");
  const [scheduledFor, setScheduledFor] = useState("");
  const queryClient = useQueryClient();
  const { data } = useQuery<TasksResponse>({ queryKey: TASKS_QUERY_KEY, refetchInterval: 15_000 });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["/api/approval/notifications?unread=true"] }),
    ]);
  };

  const createTask = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/execution/tasks", {
        text: draft.trim(),
        assignee,
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
      });
      return response.json();
    },
    onSuccess: async () => {
      setDraft("");
      setScheduledFor("");
      await refresh();
    },
  });

  const decideSuggestion = useMutation({
    mutationFn: async ({ id, accepted }: { id: string; accepted: boolean }) => {
      const response = await apiRequest("POST", `/api/execution/tasks/${id}/acceptance`, { accepted });
      return response.json();
    },
    onSuccess: refresh,
  });

  const decideAction = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const response = await apiRequest("POST", "/api/approval/decide", {
        task_id: id,
        action: approved ? "approve" : "reject",
      });
      return response.json();
    },
    onSuccess: refresh,
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/execution/tasks/${id}/complete`),
    onSuccess: refresh,
  });

  const tasks = data?.tasks ?? [];
  const reviewItems = tasks.filter((task) => task.acceptance_status === "proposed" || needsActionApproval(task));
  const activeTasks = tasks.filter((task) => (
    task.acceptance_status !== "proposed" &&
    task.acceptance_status !== "denied" &&
    task.status !== "complete" &&
    task.approval_status !== "rejected" &&
    !needsActionApproval(task)
  ));
  const mutationError = createTask.error || decideSuggestion.error || decideAction.error || completeTask.error;

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3" data-task-dock="input-and-actions">
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="What needs to be done?"
        aria-label="Task input"
        className="w-full border-b border-white/10 bg-transparent px-1 pb-2.5 text-sm text-white placeholder:text-white/30 focus:border-cyan-200/35 focus:outline-none"
      />
      <div className="mt-2 grid grid-cols-3 divide-x divide-white/10 border-y border-white/10">
        {(["user", "zar", "both"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAssignee(value)}
            className={cn(
              "px-2 py-2 text-[11px] transition",
              assignee === value ? "bg-cyan-200/10 text-cyan-100" : "text-white/50 hover:text-white/75",
            )}
          >
            {value === "user" ? "You" : value === "zar" ? "ZAR" : "Both"}
          </button>
        ))}
      </div>
      <label className="mt-2 flex items-center gap-2 border-b border-white/10 pb-2">
        <CalendarClock size={13} className="shrink-0 text-white/35" />
        <span className="sr-only">When - optional</span>
        <input
          type="datetime-local"
          value={scheduledFor}
          onChange={(event) => setScheduledFor(event.target.value)}
          aria-label="Task date and time"
          className="min-w-0 flex-1 bg-transparent text-[11px] text-white/65 focus:outline-none"
        />
      </label>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => createTask.mutate()}
          disabled={!draft.trim() || createTask.isPending}
          className="flex h-8 items-center gap-1.5 rounded-full bg-cyan-300 px-3 text-[11px] font-medium text-black transition hover:bg-cyan-200 disabled:opacity-35"
          aria-label="Save task"
        >
          <Check size={13} /> Save
        </button>
      </div>

      {mutationError ? (
        <p className="mt-2 border-t border-red-300/20 pt-2 text-[11px] text-red-100">
          {mutationError instanceof Error ? mutationError.message : "Task update failed. Try again."}
        </p>
      ) : null}

      {reviewItems.length > 0 ? (
        <div className="mt-3 max-h-40 overflow-y-auto border-t border-white/10">
          {reviewItems.map((task) => (
            <div key={task.id} className="flex items-start gap-2 border-b border-white/[0.08] py-2.5">
              <Zap size={12} className="mt-1 shrink-0 text-violet-200/60" />
              <p className="min-w-0 flex-1 text-[12px] leading-5 text-white/75">{task.plan.summary}</p>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => task.acceptance_status === "proposed"
                    ? decideSuggestion.mutate({ id: task.id, accepted: false })
                    : decideAction.mutate({ id: task.id, approved: false })}
                  className="p-1.5 text-red-200/80 hover:text-red-100"
                  aria-label={task.acceptance_status === "proposed" ? "Deny suggestion" : "Deny action"}
                >
                  <X size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => task.acceptance_status === "proposed"
                    ? decideSuggestion.mutate({ id: task.id, accepted: true })
                    : decideAction.mutate({ id: task.id, approved: true })}
                  className="p-1.5 text-emerald-100/80 hover:text-emerald-100"
                  aria-label={task.acceptance_status === "proposed" ? "Approve suggestion" : "Approve action"}
                >
                  <Check size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activeTasks.length > 0 ? (
        <div className="mt-3 max-h-40 overflow-y-auto border-t border-white/10">
          {activeTasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2 border-b border-white/[0.08] py-2.5">
              <button
                type="button"
                onClick={() => completeTask.mutate(task.id)}
                className="mt-0.5 shrink-0 p-1 text-white/35 hover:text-emerald-100"
                aria-label="Complete task"
              >
                <CheckSquare size={14} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-5 text-white/75">{task.plan.summary}</p>
                <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-white/35">
                  <User size={10} /> {taskAssigneeLabel(task.assignee)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function needsActionApproval(task: TaskRecord): boolean {
  return task.acceptance_status === "accepted" && (
    task.approval_status === "user_required" || task.approval_status === "admin_required"
  );
}

function taskAssigneeLabel(assignee?: Assignee): string {
  if (assignee === "zar") return "ZAR";
  if (assignee === "both") return "You + ZAR";
  return "You";
}

function DockControlButton({
  control,
  active,
  attention,
  onSelect,
}: {
  readonly control: NexysDockControlDefinition;
  readonly active: boolean;
  readonly attention: boolean;
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
      <span className="relative">
        <Icon size={17} />
        {attention ? (
          <span
            className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_7px_rgba(252,211,77,0.9)]"
            aria-label={`${control.label} needs attention`}
          />
        ) : null}
      </span>
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
