import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AUTH_CONFIG } from "@shared/authConfig";
import { loginRequest } from "./authApi";
import AuthForm from "./AuthForm";
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
              <AuthForm
                username={username}
                password={password}
                securePhrase={securePhrase}
                showPassword={showPassword}
                showSecondaryAuth={showSecondaryAuth}
                isLoading={isLoading}
                onUsernameChange={setUsername}
                onPasswordChange={setPassword}
                onSecurePhraseChange={setSecurePhrase}
                onTogglePassword={() => setShowPassword((prev) => !prev)}
                onSubmit={handleSubmit}
                onBack={() => {
                  setShowSecondaryAuth(false);
                  setSecurePhrase("");
                }}
              />
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