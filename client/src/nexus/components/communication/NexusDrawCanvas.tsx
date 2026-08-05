import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eraser, Redo2, Send, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { uploadRequest } from "@/lib/uploadRequest";

const COLORS = ["#ffffff", "#22d3ee", "#a855f7", "#f472b6", "#facc15", "#34d399"];
const CANVAS_HEIGHT = 220;

interface NexusDrawCanvasProps {
  readonly ensureConversationId: () => Promise<string | undefined>;
  readonly onSent: (result: { conversationId?: string; files?: unknown[] }) => void;
}

/**
 * A small markup canvas in the console's own slot - draw, then send the
 * sketch as a real attachment through the same /upload route NexusFileUpload
 * uses. Not a full illustration app; just quick freehand markup, like the
 * iMessage sketch tool.
 */
export function NexusDrawCanvas({ ensureConversationId, onSent }: NexusDrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokesRef = useRef<ImageData[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [erasing, setErasing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Sized via ResizeObserver rather than a one-time clientWidth read - on
    // mobile this mounts inside a slot that's still settling its layout
    // (mode-switch transition, dynamic viewport), so a mount-only read can
    // grab a stale/zero width and leave the backing buffer CSS-stretched
    // (blurry, off-scale strokes) instead of matching the real rendered size.
    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas!.clientWidth;
      if (!width) return;
      const targetWidth = Math.round(width * ratio);
      const targetHeight = Math.round(CANVAS_HEIGHT * ratio);
      if (canvas!.width === targetWidth && canvas!.height === targetHeight) return;
      canvas!.width = targetWidth;
      canvas!.height = targetHeight;
      const ctx = canvas!.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.fillStyle = "#0b0a1a";
        ctx.fillRect(0, 0, width, CANVAS_HEIGHT);
      }
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas unavailable");
      const conversationId = await ensureConversationId();
      if (!conversationId) throw new Error("Could not start a conversation for this sketch");

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not export sketch"))), "image/png");
      });
      const file = new File([blob], `sketch-${Date.now()}.png`, { type: "image/png" });

      const formData = new FormData();
      formData.append("files", file);
      const data = await uploadRequest<any>(
        `/api/conversations/${conversationId}/upload`,
        formData,
      );
      return { conversationId, data };
    },
    onSuccess: ({ conversationId, data }) => {
      toast({ title: "Sketch sent", description: "Attached to this conversation." });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      onSent({ conversationId, files: data?.files });
      clearCanvas();
    },
    onError: (error) => {
      toast({
        title: "Couldn't send sketch",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function pushUndoSnapshot() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    strokesRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (strokesRef.current.length > 20) strokesRef.current.shift();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    pushUndoSnapshot();
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
    setHasDrawing(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const last = lastPointRef.current;
    if (!canvas || !ctx || !last) return;
    const point = getPoint(e);
    ctx.strokeStyle = erasing ? "#0b0a1a" : color;
    ctx.lineWidth = erasing ? 18 : 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function undo() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const snapshot = strokesRef.current.pop();
    if (!canvas || !ctx || !snapshot) return;
    ctx.putImageData(snapshot, 0, 0);
    setHasDrawing(strokesRef.current.length > 0);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.fillStyle = "#0b0a1a";
    ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    strokesRef.current = [];
    setHasDrawing(false);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-2">
      <canvas
        ref={canvasRef}
        style={{ height: CANVAS_HEIGHT, touchAction: "none" }}
        className="w-full cursor-crosshair rounded-lg"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
              aria-label={`Color ${c}`}
              aria-pressed={!erasing && color === c}
              className={cn(
                "h-6 w-6 shrink-0 rounded-full border-2 transition-transform",
                !erasing && color === c ? "scale-110 border-white" : "border-white/20",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            onClick={() => setErasing((v) => !v)}
            aria-pressed={erasing}
            aria-label="Eraser"
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-white/70 transition-colors",
              erasing ? "border-cyan-300 bg-cyan-300/10 text-cyan-200" : "border-white/20 hover:text-white",
            )}
          >
            <Eraser size={12} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={strokesRef.current.length === 0}
            aria-label="Undo"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-colors hover:text-white disabled:opacity-30"
          >
            <Redo2 size={13} className="-scale-x-100" />
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            disabled={!hasDrawing}
            aria-label="Clear"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-colors hover:text-red-300 disabled:opacity-30"
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => sendMutation.mutate()}
            disabled={!hasDrawing || sendMutation.isLoading}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-[12px] font-medium text-black transition-colors hover:bg-cyan-300 disabled:opacity-40"
          >
            <Send size={12} />
            {sendMutation.isLoading ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
