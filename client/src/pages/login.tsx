import { useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useAuth } from "@/components/auth/UseAuth";

const zLogoPath =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";

export default function Login() {
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { refresh } = useAuth() as { refresh: () => Promise<void> };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!passphrase) {
      setError("Please enter your passphrase.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ passphrase }),
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
          <div className="mb-4">
            <img src={zLogoPath} alt="ZED" className="w-16 h-16 mx-auto opacity-70" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            ZED
          </h1>
          <p className="text-muted-foreground mt-2">Enhanced AI Assistant</p>
        </div>

        <Card className="zed-glass border-white/10">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-foreground">
              Access ZED
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Enter your secure passphrase to continue
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Passphrase
                </label>
                <div className="relative">
                  <Input
                    type={showPassphrase ? "text" : "password"}
                    placeholder="Enter your secure passphrase"
                    value={passphrase}
                    onChange={(e) => {
                      setPassphrase(e.target.value);
                      if (error) setError("");
                    }}
                    className="zed-input pr-10"
                    disabled={isLoading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

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
                    <span>Enter</span>
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground text-sm mt-6">
          Local authentication • No external dependencies
        </p>
      </div>
    </div>
  );
}
