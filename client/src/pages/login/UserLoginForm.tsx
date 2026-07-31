import { useState } from "react";
import { Eye, EyeOff, KeyRound, Sparkles, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Non-admin username + password login. Hits /api/login the same way
 * the secure-phrase form does, just with a different payload shape.
 */
export function UserLoginForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Enter a username and password.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (data.success) {
        await onSuccess();
        return;
      }
      setError(data.error || "Access denied.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Username</label>
        <div className="relative">
          <Input
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="zar-input pl-10"
            disabled={isLoading}
            autoFocus
          />
          <User
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Password</label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="zar-input pl-10 pr-10"
            disabled={isLoading}
          />
          <KeyRound
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button
        type="submit"
        className="w-full zar-gradient text-white hover:zar-gradient-hover"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span>Verifying...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Sparkles size={16} />
            <span>Sign In</span>
          </div>
        )}
      </Button>
    </form>
  );
}
