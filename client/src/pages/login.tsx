import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail, Sparkles, User } from "lucide-react";

import { useAuth } from "@/components/auth/UseAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { zedLogoSrc } from "@/lib/zedLogo";

type AdminStep = "enter_email" | "enter_code";

export default function Login() {
  // User login (non-admin) state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Admin email + OTP state
  const [adminStep, setAdminStep] = useState<AdminStep>("enter_email");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [adminEmailHint, setAdminEmailHint] = useState<string>("");
  const [deliveryChannel, setDeliveryChannel] = useState<"email" | "server_log" | undefined>();

  // Shared
  const [useAdminLogin, setUseAdminLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const { refresh } = useAuth() as { refresh: () => Promise<void> };

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/login/email", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.adminEmail) setAdminEmailHint(data.adminEmail);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!adminEmail.trim()) {
      setError("Enter the admin email.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/login/request-code", {
        method: "POST",
        body: JSON.stringify({ email: adminEmail.trim() }),
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
      setAdminStep("enter_code");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!adminCode.trim()) {
      setError("Enter the code from your email.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/login/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: adminEmail.trim(), code: adminCode.trim() }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (data.success) {
        await refresh();
        return;
      }
      setError(data.error || "Invalid or expired code.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
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

  const switchTab = (toAdmin: boolean) => {
    setUseAdminLogin(toAdmin);
    resetMessages();
  };

  const restartAdminFlow = () => {
    setAdminStep("enter_email");
    setAdminCode("");
    setDeliveryChannel(undefined);
    resetMessages();
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
                onClick={() => switchTab(true)}
                className={`flex-1 px-4 py-2 text-sm ${useAdminLogin ? "bg-white/10 text-white" : "text-muted-foreground"}`}
              >
                Admin Email
              </button>
              <button
                type="button"
                onClick={() => switchTab(false)}
                className={`flex-1 px-4 py-2 text-sm ${!useAdminLogin ? "bg-white/10 text-white" : "text-muted-foreground"}`}
              >
                User Login
              </button>
            </div>

            {useAdminLogin ? (
              <form
                onSubmit={adminStep === "enter_email" ? handleRequestCode : handleVerifyCode}
                className="space-y-4"
              >
                {adminStep === "enter_email" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Admin Email</label>
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder={adminEmailHint || "admin@zed-ai.online"}
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
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
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                      onClick={restartAdminFlow}
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
                      <span>{adminStep === "enter_email" ? "Sending..." : "Verifying..."}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Sparkles size={16} />
                      <span>{adminStep === "enter_email" ? "Send sign-in code" : "Verify and sign in"}</span>
                    </div>
                  )}
                </Button>

                {deliveryChannel === "server_log" && adminStep === "enter_code" && (
                  <p className="text-xs text-amber-300">
                    Email delivery is not configured on this deploy. Retrieve the code from the
                    server log.
                  </p>
                )}
              </form>
            ) : (
              <form onSubmit={handleUserLogin} className="space-y-4">
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
                      <span>Sign In</span>
                    </div>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
