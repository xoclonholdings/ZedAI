import { useEffect, useState } from "react";
import { KeyRound, Mail, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminStep = "enter_email" | "enter_code";

/**
 * Two-step admin login: enter email → receive OTP → enter OTP.
 * The "delivery channel" comes from the server — when SMTP isn't
 * configured we show an amber hint pointing at the server log.
 */
export function AdminEmailForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [step, setStep] = useState<AdminStep>("enter_email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState<"email" | "server_log" | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/login/email", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.adminEmail) setEmailHint(data.adminEmail);
      })
      .catch(() => {
        /* the placeholder is purely cosmetic — fall back to the literal default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function reset() {
    setError("");
    setInfo("");
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (!email.trim()) {
      setError("Enter the admin email.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/login/request-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not request a code.");
        return;
      }
      setDeliveryChannel(data.delivery_channel);
      setInfo(
        data.delivery_channel === "server_log"
          ? "Code generated. Email isn't configured — check the server log to retrieve it."
          : data.message ||
              "If that email is recognized, a sign-in code has been sent. Enter it below.",
      );
      setStep("enter_code");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (!code.trim()) {
      setError("Enter the code from your email.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/login/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (data.success) {
        await onSuccess();
        return;
      }
      setError(data.error || "Invalid or expired code.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function restart() {
    setStep("enter_email");
    setCode("");
    setDeliveryChannel(undefined);
    reset();
  }

  return (
    <form
      onSubmit={step === "enter_email" ? handleRequestCode : handleVerifyCode}
      className="space-y-4"
    >
      {step === "enter_email" ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Admin Email</label>
          <div className="relative">
            <Input
              type="email"
              placeholder={emailHint || "admin@zed-ai.online"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="zed-input pl-10"
              disabled={isLoading}
              autoFocus
            />
            <Mail
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            We'll email a one-time sign-in code.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Sign-in Code</label>
          <div className="relative">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="zed-input pl-10 tracking-widest text-center text-lg"
              disabled={isLoading}
              autoFocus
            />
            <KeyRound
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          <button
            type="button"
            onClick={restart}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Use a different email or request a new code
          </button>
        </div>
      )}

      {info && <p className="text-sm text-cyan-300">{info}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button
        type="submit"
        className="w-full zed-gradient text-white hover:zed-gradient-hover"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span>{step === "enter_email" ? "Sending..." : "Verifying..."}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Sparkles size={16} />
            <span>{step === "enter_email" ? "Send sign-in code" : "Verify and sign in"}</span>
          </div>
        )}
      </Button>

      {deliveryChannel === "server_log" && step === "enter_code" && (
        <p className="text-xs text-amber-300">
          Email delivery is not configured on this deploy. Retrieve the code from the server log.
        </p>
      )}
    </form>
  );
}
