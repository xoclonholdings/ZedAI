import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Fallback admin login for when SMTP / mailbox isn't reachable. Same
 * server-side session as the email flow — just a different credential
 * path. The phrase comes from the admin's secured config.
 */
export function SecurePhraseForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => Promise<void>;
  onCancel: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  const [showPhrase, setShowPhrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!phrase.trim()) {
      setError("Enter the admin secure phrase.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ passphrase: phrase.trim() }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (data.success) {
        await onSuccess();
        return;
      }
      setError(data.error || "Invalid secure phrase.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Secure Phrase</label>
        <div className="relative">
          <Input
            type={showPhrase ? "text" : "password"}
            placeholder="Enter admin secure phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className="zed-input pr-10"
            disabled={isLoading}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPhrase(!showPhrase)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPhrase ? "Hide phrase" : "Show phrase"}
          >
            {showPhrase ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground/80">
          Fallback for when email isn't reachable. Same admin session as the email flow.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          className="flex-1 zed-gradient text-white hover:zed-gradient-hover"
          disabled={isLoading}
        >
          {isLoading ? "Verifying…" : "Sign in with phrase"}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
