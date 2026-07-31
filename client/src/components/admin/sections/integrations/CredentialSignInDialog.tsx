import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sign-in dialog for providers with no paste-a-token path (Instagram,
 * Facebook, LinkedIn, TikTok). ZAR drives a real browser and fills in
 * the username/password itself — autofill, not a password-grant API
 * call — then keeps the resulting session. If the provider throws up
 * something ZAR doesn't recognize (a CAPTCHA, a redesigned page), the
 * dialog switches to a live view of that exact browser so the human
 * can finish it themselves; ZAR picks the session back up from there.
 */

type Step =
  | { kind: "credentials" }
  | { kind: "verifying"; pendingId: string; screenshotBase64?: string; prompt?: string }
  | { kind: "handoff"; pendingId: string; screenshotBase64?: string; prompt?: string }
  | { kind: "live"; pendingId: string }
  | { kind: "error"; message: string }
  | { kind: "done" };

interface SignInApiResult {
  status: "success" | "verification_required" | "human_required" | "error";
  pendingId?: string;
  screenshotBase64?: string;
  prompt?: string;
  message?: string;
}

export function CredentialSignInDialog({
  provider,
  label,
  onClose,
  onConnected,
}: {
  provider: string;
  label: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "credentials" });

  const applyResult = useCallback((result: SignInApiResult) => {
    if (result.status === "success") {
      setStep({ kind: "done" });
      return;
    }
    if (result.status === "verification_required" && result.pendingId) {
      setStep({
        kind: "verifying",
        pendingId: result.pendingId,
        screenshotBase64: result.screenshotBase64,
        prompt: result.prompt,
      });
      return;
    }
    if (result.status === "human_required" && result.pendingId) {
      setStep({
        kind: "handoff",
        pendingId: result.pendingId,
        screenshotBase64: result.screenshotBase64,
        prompt: result.prompt,
      });
      return;
    }
    setStep({ kind: "error", message: result.message || "Sign-in failed." });
  }, []);

  const start = useCallback(async () => {
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/integrations/${provider}/signin/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const body = await res.json();
      applyResult(res.ok ? body : { status: "error", message: body?.error || "Sign-in failed." });
    } catch (err: any) {
      setStep({ kind: "error", message: err?.message || "Sign-in failed." });
    } finally {
      setBusy(false);
    }
  }, [provider, username, password, applyResult]);

  const verify = useCallback(
    async (pendingId: string) => {
      if (!code.trim()) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/integrations/${provider}/signin/verify`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pendingId, code: code.trim() }),
        });
        const body = await res.json();
        applyResult(res.ok ? body : { status: "error", message: body?.error || "Verification failed." });
        setCode("");
      } catch (err: any) {
        setStep({ kind: "error", message: err?.message || "Verification failed." });
      } finally {
        setBusy(false);
      }
    },
    [provider, code, applyResult],
  );

  const cancel = useCallback(
    async (pendingId?: string) => {
      if (pendingId) {
        void fetch(`/api/admin/integrations/${provider}/signin/cancel`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pendingId }),
        }).catch(() => {});
      }
      onClose();
    },
    [provider, onClose],
  );

  useEffect(() => {
    if (step.kind === "done") {
      onConnected();
    }
  }, [step, onConnected]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => cancel(step.kind === "handoff" || step.kind === "verifying" || step.kind === "live" ? step.pendingId : undefined)}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16.5px] font-semibold text-white mb-1">Sign in to {label}</h3>
        <p className="mt-1 text-[12.5px] text-white/50 leading-snug mb-4">
          ZAR signs in the same way you would — it fills in your username and password on{" "}
          {label}'s own login page. Your password is stored the same way as any other saved
          credential and never leaves this account.
        </p>

        {step.kind === "credentials" && (
          <>
            <div className="mb-3">
              <label className="block text-[12.5px] font-medium text-white/70 mb-1">
                Username or email
              </label>
              <input
                type="text"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              />
            </div>
            <div className="mb-5">
              <label className="block text-[12.5px] font-medium text-white/70 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void start()}
                className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => cancel()}
                className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void start()}
                disabled={busy || !username.trim() || !password}
                className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </>
        )}

        {step.kind === "verifying" && (
          <>
            <p className="text-[13px] text-white/80 mb-3">{step.prompt}</p>
            {step.screenshotBase64 && (
              <img
                src={`data:image/png;base64,${step.screenshotBase64}`}
                alt="Sign-in step"
                className="w-full rounded-lg border border-white/10 mb-3"
              />
            )}
            <div className="mb-4">
              <label className="block text-[12.5px] font-medium text-white/70 mb-1">
                Verification code
              </label>
              <input
                type="text"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void verify(step.pendingId)}
                className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep({ kind: "live", pendingId: step.pendingId })}
                className="text-[12.5px] text-cyan-300 hover:text-cyan-200 transition-colors"
              >
                This isn't right — let me take over the browser
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cancel(step.pendingId)}
                  className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void verify(step.pendingId)}
                  disabled={busy || !code.trim()}
                  className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? "Checking…" : "Submit code"}
                </button>
              </div>
            </div>
          </>
        )}

        {step.kind === "handoff" && (
          <>
            <p className="text-[13px] text-white/80 mb-3">{step.prompt}</p>
            {step.screenshotBase64 && (
              <img
                src={`data:image/png;base64,${step.screenshotBase64}`}
                alt="Where ZAR got stuck"
                className="w-full rounded-lg border border-white/10 mb-3"
              />
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => cancel(step.pendingId)}
                className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
              >
                Give up
              </button>
              <button
                type="button"
                onClick={() => setStep({ kind: "live", pendingId: step.pendingId })}
                className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors"
              >
                Take over the browser
              </button>
            </div>
          </>
        )}

        {step.kind === "live" && (
          <LiveHandoffView
            provider={provider}
            pendingId={step.pendingId}
            onResult={applyResult}
            onCancel={() => cancel(step.pendingId)}
          />
        )}

        {step.kind === "error" && (
          <>
            <p className="text-[13px] text-red-300 mb-4">{step.message}</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => cancel()}
                className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setStep({ kind: "credentials" })}
                className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors"
              >
                Try again
              </button>
            </div>
          </>
        )}

        {step.kind === "done" && (
          <p className="text-[13px] text-emerald-300">Signed in — closing…</p>
        )}
      </div>
    </div>
  );
}

/**
 * The live take-over view: streams the exact stuck browser page over
 * a WebSocket (as JPEG frames via CDP screencast) and relays the
 * human's clicks and typing back into it. Once they're done, ZAR
 * re-checks the page — if it now shows signed in, the session is
 * captured; if not, they can keep going.
 */
function LiveHandoffView({
  provider,
  pendingId,
  onResult,
  onCancel,
}: {
  provider: string;
  pendingId: string;
  onResult: (result: SignInApiResult) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const screenSizeRef = useRef<{ width: number; height: number }>({ width: 1280, height: 900 });
  const [typedText, setTypedText] = useState("");
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "error">("connecting");
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/admin/integrations/${provider}/signin/handoff/ticket`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId }),
      });
      if (!res.ok || cancelled) {
        setConnectionState("error");
        return;
      }
      const { ticket, wsPath } = await res.json();
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}${wsPath}?ticket=${ticket}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "ready") {
          if (msg.screenSize) screenSizeRef.current = msg.screenSize;
          setConnectionState("live");
        } else if (msg.type === "frame") {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const img = new Image();
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
          };
          img.src = `data:image/jpeg;base64,${msg.data}`;
        } else if (msg.type === "error") {
          setConnectionState("error");
        }
      };
      ws.onerror = () => setConnectionState("error");
    })();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [provider, pendingId]);

  const scaledPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width || 1;
    const scaleY = canvas.height / rect.height || 1;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const send = useCallback((payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const finalize = useCallback(async () => {
    setFinalizing(true);
    wsRef.current?.close();
    try {
      const res = await fetch(`/api/admin/integrations/${provider}/signin/handoff/finalize`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId }),
      });
      const body = await res.json();
      onResult(res.ok ? body : { status: "error", message: body?.error || "Couldn't finish sign-in." });
    } catch (err: any) {
      onResult({ status: "error", message: err?.message || "Couldn't finish sign-in." });
    } finally {
      setFinalizing(false);
    }
  }, [provider, pendingId, onResult]);

  return (
    <div>
      <p className="text-[12.5px] text-white/50 mb-2">
        This is the exact browser ZAR was using — click and type in it directly, same as any other
        page. When you're done, tap "I'm done."
      </p>
      <div className="relative rounded-lg border border-white/10 overflow-hidden mb-3 bg-black">
        {connectionState !== "live" && (
          <div className="aspect-[16/11] flex items-center justify-center text-[12.5px] text-white/50">
            {connectionState === "connecting" ? "Connecting…" : "Couldn't connect to the live view."}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={connectionState === "live" ? "w-full h-auto cursor-pointer" : "hidden"}
          onMouseMove={(e) => {
            const { x, y } = scaledPoint(e);
            send({ type: "mouseMove", x, y });
          }}
          onMouseDown={(e) => {
            const { x, y } = scaledPoint(e);
            send({ type: "mouseDown", x, y, button: "left" });
          }}
          onMouseUp={(e) => {
            const { x, y } = scaledPoint(e);
            send({ type: "mouseUp", x, y, button: "left" });
          }}
          onWheel={(e) => {
            const { x, y } = scaledPoint(e);
            send({ type: "wheel", x, y, deltaX: e.deltaX, deltaY: e.deltaY });
          }}
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder="Click a field on the page, then type here"
          className="flex-1 text-[13px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (typedText) send({ type: "insertText", text: typedText });
              send({ type: "key", key: "Enter" });
              setTypedText("");
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (typedText) send({ type: "insertText", text: typedText });
            setTypedText("");
          }}
          className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white transition-colors"
        >
          Type
        </button>
        <button
          type="button"
          onClick={() => send({ type: "key", key: "Backspace" })}
          className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white transition-colors"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => send({ type: "key", key: "Tab" })}
          className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white transition-colors"
        >
          Tab
        </button>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
        >
          Give up
        </button>
        <button
          type="button"
          onClick={() => void finalize()}
          disabled={finalizing}
          className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 transition-colors"
        >
          {finalizing ? "Checking…" : "I'm done"}
        </button>
      </div>
    </div>
  );
}
