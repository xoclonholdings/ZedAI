import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Eraser,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  PenTool,
  Send,
  Upload,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useNexusDictation } from "../../communication/useNexusDictation";
import type { NexusCommunicationModeId } from "../../communication/types";
import type { NexusCommunicationModeView } from "../../viewport/NexusViewportModel";
import { NexusMessageComposer } from "./NexusMessageComposer";

/**
 * Mode-adaptive communication surface. The selected create mode
 * transforms the interface — only the controls for that mode exist on
 * screen. Modes come from the persistent communication manifest; nothing
 * here hardcodes the mode list.
 */

export interface NexusAdaptiveComposerProps {
  readonly modes: readonly NexusCommunicationModeView[];
  readonly activeMode: NexusCommunicationModeId;
  readonly onModeChange: (mode: NexusCommunicationModeId) => void;
  readonly composerValue: string;
  readonly onComposerValueChange: (value: string) => void;
  readonly onSend: (message: string) => void;
  readonly onAbort?: () => void;
  readonly isStreaming?: boolean;
  readonly onOpenFileUpload: () => void;
  readonly editModeLabel?: string | null;
  readonly onCancelEdit?: () => void;
  /** Resolves the conversation files should attach to (creates one when needed). */
  readonly ensureUploadConversationId: () => Promise<string | null>;
  readonly onUploaded: (files: File[], result: { conversationId?: string }) => void;
}

const MODE_ICONS: Record<string, typeof MessageCircle> = {
  text: MessageCircle,
  talk: Mic,
  image: ImageIcon,
  draw: PenTool,
  doc: FileText,
  upload: Upload,
};

interface UploadProgressState {
  readonly fileNames: string[];
  readonly status: "uploading" | "done" | "error";
  readonly detail?: string;
}

export function NexusAdaptiveComposer(props: NexusAdaptiveComposerProps) {
  const { modes, activeMode, onModeChange } = props;
  const [uploadState, setUploadState] = useState<UploadProgressState | null>(null);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const conversationId = await props.ensureUploadConversationId();
      if (!conversationId) return;
      setUploadState({ fileNames: files.map((f) => f.name), status: "uploading" });
      try {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        const response = await fetch(`/api/conversations/${conversationId}/upload`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        const data = await response.json();
        setUploadState({ fileNames: files.map((f) => f.name), status: "done" });
        props.onUploaded(files, { conversationId: data?.conversationId || conversationId });
        setTimeout(() => setUploadState(null), 2_500);
      } catch (error) {
        setUploadState({
          fileNames: files.map((f) => f.name),
          status: "error",
          detail: error instanceof Error ? error.message : "Upload failed",
        });
      }
    },
    [props],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Create modes">
        {modes.map((mode) => {
          const Icon = MODE_ICONS[mode.id] ?? MessageCircle;
          const active = mode.id === activeMode;
          return (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={!mode.enabled}
              onClick={() => mode.enabled && onModeChange(mode.id as NexusCommunicationModeId)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] transition focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none",
                active
                  ? "border-cyan-200/40 bg-cyan-200/[0.12] text-cyan-50"
                  : "border-white/[0.08] bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white",
                !mode.enabled && "cursor-not-allowed opacity-35",
              )}
              title={mode.label}
            >
              <Icon size={14} />
              {active ? <span>{mode.label}</span> : null}
            </button>
          );
        })}
      </div>

      {activeMode === "text" && (
        <NexusMessageComposer
          value={props.composerValue}
          onValueChange={props.onComposerValueChange}
          onSend={props.onSend}
          onAbort={props.onAbort}
          isStreaming={props.isStreaming}
          onOpenFileUpload={props.onOpenFileUpload}
          editModeLabel={props.editModeLabel}
          onCancelEdit={props.onCancelEdit}
        />
      )}

      {activeMode === "talk" && (
        <TalkSurface
          value={props.composerValue}
          onValueChange={props.onComposerValueChange}
          onSend={props.onSend}
          isStreaming={props.isStreaming}
        />
      )}

      {activeMode === "image" && (
        <PickerSurface
          icon={<ImageIcon size={26} className="text-white/45" />}
          headline="Share an image"
          hint="PNG, JPEG, GIF, or WebP"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          onFiles={uploadFiles}
          extraActions={[{ label: "Camera", icon: <Camera size={14} />, capture: "environment" }]}
          uploadState={uploadState}
          preview="image"
        />
      )}

      {activeMode === "draw" && <DrawSurface onSubmit={(file) => void uploadFiles([file])} uploadState={uploadState} />}

      {activeMode === "doc" && (
        <PickerSurface
          icon={<FileText size={26} className="text-white/45" />}
          headline="Share a document"
          hint="PDF, Word, Excel, PowerPoint, CSV, Markdown, or text"
          accept=".pdf,.docx,.xlsx,.pptx,.csv,.md,.txt,.json"
          multiple
          onFiles={uploadFiles}
          uploadState={uploadState}
        />
      )}

      {activeMode === "upload" && (
        <PickerSurface
          icon={<Upload size={26} className="text-white/45" />}
          headline="Drop files to upload"
          hint="Attached to the conversation and processed into Knowledge"
          accept=".pdf,.docx,.xlsx,.pptx,.csv,.md,.txt,.json,.png,.jpg,.jpeg,.gif,.webp,.zip"
          multiple
          onFiles={uploadFiles}
          uploadState={uploadState}
        />
      )}
    </div>
  );
}

function TalkSurface({
  value,
  onValueChange,
  onSend,
  isStreaming,
}: {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onSend: (message: string) => void;
  readonly isStreaming?: boolean;
}) {
  const dictation = useNexusDictation(onValueChange);
  const trimmed = value.trim();

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.09] bg-black/45 px-4 py-6">
      <button
        type="button"
        onClick={dictation.toggle}
        disabled={!dictation.speechSupported || isStreaming}
        aria-label={dictation.isDictating ? "Stop listening" : "Start talking"}
        className={cn(
          "flex h-20 w-20 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none",
          dictation.isDictating
            ? "border-red-300/45 bg-red-500/15 text-red-200"
            : "border-cyan-200/35 bg-cyan-200/[0.1] text-cyan-100 hover:bg-cyan-200/[0.16]",
          !dictation.speechSupported && "cursor-not-allowed opacity-35",
        )}
      >
        <Mic size={30} />
      </button>

      <div className="flex h-6 items-end gap-[3px]" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-full bg-cyan-200/60 transition-all",
              dictation.isDictating ? "animate-pulse" : "opacity-25",
            )}
            style={{
              height: dictation.isDictating ? `${6 + ((i * 7919) % 18)}px` : "4px",
              animationDelay: `${(i % 8) * 90}ms`,
            }}
          />
        ))}
      </div>

      <div className="min-h-[20px] max-w-md text-center text-sm text-white/70">
        {dictation.isDictating
          ? trimmed || "Listening…"
          : trimmed || (dictation.speechSupported ? "Tap the microphone and speak" : "Voice input is not supported in this browser")}
      </div>

      {trimmed ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onValueChange("")}
            className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[12px] text-white/55 hover:text-white"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => onSend(trimmed)}
            disabled={isStreaming}
            className="flex items-center gap-1.5 rounded-full bg-cyan-300 px-4 py-1.5 text-[12px] font-semibold text-black hover:bg-cyan-200 disabled:opacity-40"
          >
            <Send size={13} /> Send
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PickerSurface({
  icon,
  headline,
  hint,
  accept,
  multiple,
  onFiles,
  extraActions = [],
  uploadState,
  preview,
}: {
  readonly icon: React.ReactNode;
  readonly headline: string;
  readonly hint: string;
  readonly accept: string;
  readonly multiple?: boolean;
  readonly onFiles: (files: File[]) => void | Promise<void>;
  readonly extraActions?: ReadonlyArray<{ label: string; icon: React.ReactNode; capture: string }>;
  readonly uploadState: UploadProgressState | null;
  readonly preview?: "image";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)), [previewUrls]);

  function handleFiles(files: File[]) {
    if (files.length === 0) return;
    if (preview === "image") {
      setPreviewUrls((prev) => {
        prev.forEach((url) => URL.revokeObjectURL(url));
        return files.filter((f) => f.type.startsWith("image/")).map((f) => URL.createObjectURL(f));
      });
    }
    void onFiles(files);
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(Array.from(e.dataTransfer.files || []));
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition",
          dragActive ? "border-cyan-300/55 bg-cyan-300/[0.07]" : "border-white/15 bg-black/40 hover:border-white/30",
        )}
      >
        {icon}
        <div className="text-sm font-medium text-white">{headline}</div>
        <div className="text-xs text-white/45">{hint}</div>
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files || []))} />
      </div>

      {extraActions.length > 0 && (
        <div className="flex justify-center gap-2">
          {extraActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => captureRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3 py-1.5 text-[12px] text-white/60 hover:text-white"
            >
              {action.icon} {action.label}
            </button>
          ))}
          <input
            ref={captureRef}
            type="file"
            accept={accept}
            capture={extraActions[0]?.capture as any}
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          />
        </div>
      )}

      {previewUrls.length > 0 && (
        <div className="flex justify-center gap-2">
          {previewUrls.slice(0, 4).map((url) => (
            <img key={url} src={url} alt="Selected" className="h-16 w-16 rounded-xl border border-white/10 object-cover" />
          ))}
        </div>
      )}

      <UploadStatus state={uploadState} />
    </div>
  );
}

function DrawSurface({
  onSubmit,
  uploadState,
}: {
  readonly onSubmit: (file: File) => void;
  readonly uploadState: UploadProgressState | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [penColor, setPenColor] = useState("#67e8f9");
  const [penSize, setPenSize] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#05060d";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, []);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handleDown(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    const point = pointFrom(event);
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
  }

  function handleMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const point = pointFrom(event);
    if (ctx) {
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      setHasInk(true);
    }
  }

  function handleUp() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.fillStyle = "#05060d";
      ctx.fillRect(0, 0, rect.width, rect.height);
      setHasInk(false);
    }
  }

  function submitDrawing() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      onSubmit(new File([blob], `drawing-${Date.now()}.png`, { type: "image/png" }));
    }, "image/png");
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="h-56 w-full touch-none rounded-2xl border border-white/[0.1] bg-[#05060d]"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        aria-label="Drawing canvas"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {["#67e8f9", "#f9fafb", "#f472b6", "#fbbf24", "#4ade80"].map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setPenColor(color)}
              aria-label={`Pen color ${color}`}
              className={cn(
                "h-6 w-6 rounded-full border transition",
                penColor === color ? "border-white scale-110" : "border-white/20",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
          <div className="ml-2 flex items-center gap-1">
            {[2, 4, 8].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setPenSize(size)}
                aria-label={`Brush size ${size}`}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border",
                  penSize === size ? "border-cyan-200/50 bg-cyan-200/[0.12]" : "border-white/[0.1]",
                )}
              >
                <span className="rounded-full bg-white/80" style={{ width: size + 2, height: size + 2 }} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3 py-1.5 text-[12px] text-white/55 hover:text-white"
          >
            <Eraser size={13} /> Clear
          </button>
          <button
            type="button"
            onClick={submitDrawing}
            disabled={!hasInk}
            className="flex items-center gap-1.5 rounded-full bg-cyan-300 px-4 py-1.5 text-[12px] font-semibold text-black hover:bg-cyan-200 disabled:opacity-35"
          >
            <Send size={13} /> Send drawing
          </button>
        </div>
      </div>
      <UploadStatus state={uploadState} />
    </div>
  );
}

function UploadStatus({ state }: { readonly state: UploadProgressState | null }) {
  if (!state) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border px-3 py-2 text-[12px]",
        state.status === "error"
          ? "border-red-300/25 bg-red-500/[0.08] text-red-200"
          : state.status === "done"
            ? "border-emerald-300/25 bg-emerald-500/[0.08] text-emerald-200"
            : "border-white/[0.1] bg-white/[0.04] text-white/65",
      )}
      role="status"
    >
      <span className="truncate">
        {state.fileNames.join(", ")}
        {state.detail ? ` — ${state.detail}` : ""}
      </span>
      <span className="ml-2 shrink-0 capitalize">
        {state.status === "uploading" ? "Uploading…" : state.status === "done" ? "Attached" : <X size={13} />}
      </span>
    </div>
  );
}
