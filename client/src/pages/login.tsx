import { useState } from "react";
import { Eye, EyeOff, KeyRound, Sparkles, User } from "lucide-react";

import { useAuth } from "@/components/auth/UseAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { zedLogoSrc } from "@/lib/zedLogo";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [usePassphrase, setUsePassphrase] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { refresh } = useAuth() as { refresh: () => Promise<void> };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (usePassphrase && !passphrase.trim()) {
      setError("Enter the admin secure phrase.");
      return;
    }

    if (!usePassphrase && (!username.trim() || !password.trim())) {
      setError("Enter a username and password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify(
          usePassphrase
            ? { passphrase: passphrase.trim() }
            : { username: username.trim(), password },
        ),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        await refresh();
        return;
      }

      setError(data.error || "Access denied.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-20 top-20 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl zed-float" />
        <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-fuchsia-500/5 blur-3xl zed-float zed-delay-4s" />
        <div className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl zed-float zed-delay-2s" />
      </div>

      <div className="absolute inset-0 opacity-5 pointer-events-none zed-grid-overlay" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.3),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(255,61,154,0.28),_transparent_60%)] blur-2xl" />
            <img
              src={zedLogoSrc}
              alt="ZED"
              className="relative z-10 h-24 w-24 object-contain drop-shadow-[0_0_28px_rgba(0,240,255,0.28)]"
            />
          </div>
        </div>

        <Card className="zed-glass border-white/10">
          <CardContent className="space-y-4 pt-6">
            <div className="flex overflow-hidden rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setUsePassphrase(true)}
                className={`flex-1 px-4 py-2 text-sm ${usePassphrase ? "bg-white/10 text-white" : "text-muted-foreground"}`}
              >
                Admin Phrase
              </button>
              <button
                type="button"
                onClick={() => setUsePassphrase(false)}
                className={`flex-1 px-4 py-2 text-sm ${!usePassphrase ? "bg-white/10 text-white" : "text-muted-foreground"}`}
              >
                User Login
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {usePassphrase ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Secure Phrase</label>
                  <div className="relative">
                    <Input
                      type={showPassphrase ? "text" : "password"}
                      placeholder="Enter admin secure phrase"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="zed-input pr-10"
                      disabled={isLoading}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Username</label>
                    <div className="relative">
                      <Input
                        placeholder="Enter username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="zed-input pl-10"
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
                        className="zed-input pl-10 pr-10"
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
                </>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                type="submit"
                className="w-full zed-gradient text-white hover:zed-gradient-hover"
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
                    <span>{usePassphrase ? "Enter with Secure Phrase" : "Sign In"}</span>
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
