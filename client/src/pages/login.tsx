import { useState } from "react";
import { Eye, EyeOff, KeyRound, Sparkles, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/components/auth/UseAuth";
import zedLogo from "@assets/Zed_logo.png";

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
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl zed-float" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl zed-float zed-delay-4s" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl zed-float zed-delay-2s" />
      </div>

      <div className="absolute inset-0 opacity-5 pointer-events-none zed-grid-overlay" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <img
              src={zedLogo}
              alt="ZED"
              className="w-28 h-28 object-contain drop-shadow-[0_0_32px_rgba(168,85,247,0.45)]"
            />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            ZED
          </h1>
          <p className="text-muted-foreground mt-2">Local-first AI workspace</p>
        </div>

        <Card className="zed-glass border-white/10">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-foreground">Access ZED</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Use the admin secure phrase or sign in with a managed local user.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex rounded-xl border border-white/10 overflow-hidden">
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
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
                      <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
                className="w-full zed-gradient hover:zed-gradient-hover text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

        <p className="text-center text-muted-foreground text-sm mt-6">
          Local authentication • Admin-managed users
        </p>
      </div>
    </div>
  );
}
