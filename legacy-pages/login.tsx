import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Sparkles, Zap } from "lucide-react";
const zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";
import { useAuth } from "@/hooks/useAuth";
import { useAuthMock } from "@/hooks/useAuthMock";

export default function Login() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [securePhrase, setSecurePhrase] = useState("");
  const [showSecondaryAuth, setShowSecondaryAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { refetch } = useAuth();
  const mockAuth = useAuthMock();

  // Use mock auth as fallback
  const USE_MOCK_AUTH = false; // Set to false when server is working

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Missing credentials",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (USE_MOCK_AUTH) {
        // Use mock authentication
        const result = await mockAuth.login(credentials.username, credentials.password);
        if (result.success) {
          toast({
            title: "Welcome to ZED",
            description: "Successfully logged in! (Mock Mode)",
          });
          window.location.reload(); // Refresh to update auth state
        } else {
          toast({
            title: "Login failed",
            description: result.reason || "Invalid credentials",
            variant: "destructive",
          });
        }
      } else {
        // Use server authentication
        const loginData: any = { 
          username: credentials.username, 
          password: credentials.password 
        };
        
        if (securePhrase) {
          loginData.securePhrase = securePhrase;
        }

        const response = await fetch("/api/login", {
          method: "POST",
          body: JSON.stringify(loginData),
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
        });

        const data = await response.json();

        if (data.success) {
          toast({
            title: "Welcome to ZED",
            description: "Successfully logged in!",
          });
          // Wait a moment for session to be established, then force refetch
          setTimeout(async () => {
            await refetch();
          }, 200);
        } else if (data.requiresSecondaryAuth) {
          setShowSecondaryAuth(true);
          toast({
            title: "Additional verification required",
            description: "Please enter your secure phrase to continue",
            variant: "default",
          });
        } else {
          toast({
            title: "Login failed",
            description: data.error || "Invalid credentials",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle animated background elements matching chat interface */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl zed-float" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl zed-float zed-delay-4s" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl zed-float zed-delay-2s" />
      </div>
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none zed-grid-overlay" />

      <div className="relative z-10 w-full max-w-md">
        {/* ZED Logo */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <img 
              src={zLogoPath} 
              alt="Z" 
              className="w-16 h-16 mx-auto opacity-70"
            />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            ZED
          </h1>
          <p className="text-muted-foreground mt-2">Enhanced AI Assistant</p>
        </div>

        <Card className="zed-glass border-white/10">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-foreground">Sign In</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Enter your credentials to access ZED
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Username</label>
                <Input
                  type="text"
                  placeholder="Enter username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  className="zed-input"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="zed-input pr-10"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {showSecondaryAuth && (
                <div className="space-y-2 border-t border-gray-700 pt-4">
                  <div className="text-sm text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3">
                    🔐 Admin verification required. Enter your secure phrase:
                  </div>
                  <Input
                    type="password"
                    placeholder="Secure Phrase (XOCLON_SECURE_2025)"
                    value={securePhrase}
                    onChange={(e) => setSecurePhrase(e.target.value)}
                    className="zed-input"
                    disabled={isLoading}
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full zed-gradient hover:zed-gradient-hover text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Sparkles size={16} />
                    <span>{showSecondaryAuth ? "Verify Access" : "Sign In"}</span>
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