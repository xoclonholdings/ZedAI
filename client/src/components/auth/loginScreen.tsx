import { useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { AUTH_CONFIG } from "@shared/authConfig";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginRequest } from "./authApi";
import zLogoPath from "@assets/IMG_2227_1753477194826.png";

export default function LoginScreen() {
  const [username, setUsername] = useState(AUTH_CONFIG.adminUsername);
  const [password, setPassword] = useState("");
  const [securePhrase, setSecurePhrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSecondaryAuth, setShowSecondaryAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!username || !password) {
      toast({
        title: "Missing credentials",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const result = await loginRequest({
      username,
      password,
      securePhrase: securePhrase || undefined,
    });

    setIsLoading(false);

    if (result.success) {
      toast({
        title: "Welcome to ZED",
        description: "Successfully logged in",
      });
      window.location.href = "/";
      return;
    }

    if (result.requiresSecondaryAuth) {
      setShowSecondaryAuth(true);
      toast({
        title: AUTH_CONFIG.adminVerificationTitle,
        description: result.error || AUTH_CONFIG.adminVerificationSubtitle,
      });
      return;
    }

    toast({
      title: "Login failed",
      description: result.error || "Invalid credentials",
      variant: "destructive",
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black px-4 py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="zed-float absolute left-10 top-16 h-72 w-72 rounded-full bg-purple-600/10 blur-3xl" />
        <div
          className="zed-float absolute bottom-10 right-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <img
              src={zLogoPath}
              alt="ZED"
              className="mx-auto mb-4 h-16 w-16 object-contain opacity-80"
            />
            <h1 className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-4xl font-bold text-transparent">
              ZED
            </h1>
            <p className="mt-2 text-sm text-gray-400">Enhanced AI Assistant</p>
          </div>

          <Card className="border-white/10 bg-black/70 backdrop-blur-md">
            <CardHeader className="space-y-2">
              <CardTitle className="text-center text-2xl text-white">
                {showSecondaryAuth
                  ? AUTH_CONFIG.adminVerificationTitle
                  : AUTH_CONFIG.loginTitle}
              </CardTitle>
              <CardDescription className="text-center text-gray-400">
                {showSecondaryAuth
                  ? AUTH_CONFIG.adminVerificationSubtitle
                  : AUTH_CONFIG.loginSubtitle}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Username</label>
                  <Input
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-11 border-gray-700 bg-gray-950 text-white placeholder:text-gray-500 focus-visible:ring-purple-500"
                    disabled={isLoading || showSecondaryAuth}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 border-gray-700 bg-gray-950 pr-10 text-white placeholder:text-gray-500 focus-visible:ring-purple-500"
                      disabled={isLoading || showSecondaryAuth}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {showSecondaryAuth && (
                  <div className="space-y-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                    <p className="text-sm text-yellow-300">
                      Admin verification required. Enter secure phrase.
                    </p>
                    <Input
                      type="password"
                      placeholder={AUTH_CONFIG.securePhrasePlaceholder}
                      value={securePhrase}
                      onChange={(e) => setSecurePhrase(e.target.value)}
                      className="h-11 border-yellow-500/30 bg-gray-950 text-white placeholder:text-gray-500 focus-visible:ring-yellow-500"
                      disabled={isLoading}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} />
                    <span>
                      {isLoading
                        ? "Signing in..."
                        : showSecondaryAuth
                          ? "Verify Access"
                          : "Sign In"}
                    </span>
                  </div>
                </Button>

                {showSecondaryAuth && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full border-gray-700 bg-transparent text-white hover:bg-gray-900"
                    onClick={() => {
                      setShowSecondaryAuth(false);
                      setSecurePhrase("");
                    }}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-gray-500">
            Server-backed auth in progress
          </p>
        </div>
      </div>
    </div>
  );
}