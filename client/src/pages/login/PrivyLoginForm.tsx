import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import { useState } from "react";
import { KeyRound, Mail, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PrivyLoginForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const { ready, authenticated, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await sendCode({ email: cleanEmail });
      setPhase("code");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the code.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode) {
      setError("Enter the code from your email.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await loginWithCode({ code: cleanCode });
      await onSuccess();
      setIsLoading(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That code did not work.");
      setIsLoading(false);
    }
  }

  if (authenticated) {
    return (
      <div className="space-y-3">
        <Button
          type="button"
          onClick={() => void onSuccess()}
          className="w-full zar-gradient text-white hover:zar-gradient-hover"
          disabled={isLoading}
        >
          {isLoading ? "Connecting..." : "Continue to ZAR"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setEmail("");
            setCode("");
            setError("");
            setPhase("email");
            void logout();
          }}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          disabled={isLoading}
        >
          Use another email
        </button>
      </div>
    );
  }

  if (phase === "code") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email code</label>
          <div className="relative">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="zar-input pl-10"
              disabled={isLoading}
              autoFocus
            />
            <KeyRound
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          <p className="text-xs text-muted-foreground">Sent to {email.trim()}</p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button
          type="submit"
          className="w-full zar-gradient text-white hover:zar-gradient-hover"
          disabled={isLoading}
        >
          {isLoading ? "Verifying..." : "Verify + Continue"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setCode("");
            setError("");
            setPhase("email");
          }}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          disabled={isLoading}
        >
          Change email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Email</label>
        <div className="relative">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email address"
            inputMode="email"
            autoComplete="email"
            className="zar-input pl-10"
            disabled={isLoading || !ready}
            autoFocus
          />
          <Mail
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button
        type="submit"
        className="w-full zar-gradient text-white hover:zar-gradient-hover"
        disabled={isLoading || !ready}
      >
        {isLoading || !ready ? (
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span>{ready ? "Sending..." : "Preparing..."}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Sparkles size={16} />
            <span>Send Code</span>
          </div>
        )}
      </Button>
    </form>
  );
}
