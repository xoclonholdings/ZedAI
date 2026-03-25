import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import zLogo from "@assets/Zed-ai-logo_1753468041342.png";

export default function EnhancedLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securePhrase, setSecurePhrase] = useState("");
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSecondaryAuth, setShowSecondaryAuth] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState("");
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const loginData: any = { username, password };
      if (securePhrase) loginData.securePhrase = securePhrase;
      if (showSecondaryAuth) loginData.requiresVerification = true;

      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Welcome to ZED",
          description: "Successfully logged in with enhanced security!",
        });
        window.location.reload();
      } else if (data.requiresSecondaryAuth) {
        setShowSecondaryAuth(true);
        setError("Admin login requires additional verification");
      } else if (data.requiresChallenge) {
        setShowChallenge(true);
        setChallengeMessage(data.message);
        setError("");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/verify-challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          challengeAnswer, 
          securePhrase: securePhrase || undefined 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowChallenge(false);
        setChallengeAnswer("");
        toast({
          title: "Challenge Verified",
          description: "Security challenge passed. Please try logging in again.",
        });
        setError("");
      } else {
        setError(data.error || "Challenge verification failed");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (showChallenge) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        {/* Cyberpunk Grid Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full" style={{
            backgroundImage: `
              linear-gradient(rgba(147, 51, 234, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(147, 51, 234, 0.3) 1px, transparent 1px),
              linear-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px'
          }} />
        </div>

        <Card className="w-full max-w-md bg-black/80 border-red-500/30 backdrop-blur-sm shadow-2xl shadow-red-500/20">
          <CardHeader className="text-center space-y-6">
            <div className="flex justify-center mb-4">
              <img 
                src={zLogo} 
                alt="Z Logo" 
                className="h-16 w-16 object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
            
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-red-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Security Challenge
              </CardTitle>
              <CardDescription className="text-gray-400 mt-2">
                {challengeMessage}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleChallenge} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Challenge Answer (42, xoclon, or diagnostic)"
                  value={challengeAnswer}
                  onChange={(e) => setChallengeAnswer(e.target.value)}
                  className="bg-black/50 border-red-500/50 text-white placeholder:text-gray-400 focus:border-red-400 focus:ring-red-400/20"
                />
              </div>
              
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Or enter secure phrase"
                  value={securePhrase}
                  onChange={(e) => setSecurePhrase(e.target.value)}
                  className="bg-black/50 border-red-500/50 text-white placeholder:text-gray-400 focus:border-red-400 focus:ring-red-400/20"
                />
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded p-2">
                  {error}
                </div>
              )}

              <div className="flex space-x-2">
                <Button 
                  type="button"
                  onClick={() => {setShowChallenge(false); setError("");}}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Back
                </Button>
                <Button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700 text-white"
                >
                  {isLoading ? "Verifying..." : "Verify"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Cyberpunk Grid Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full" style={{
          backgroundImage: `
            linear-gradient(rgba(147, 51, 234, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(147, 51, 234, 0.3) 1px, transparent 1px),
            linear-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px'
        }} />
      </div>

      <Card className="w-full max-w-md bg-black/80 border-purple-500/30 backdrop-blur-sm shadow-2xl shadow-purple-500/20">
        <CardHeader className="text-center space-y-6">
          {/* Overhead transparent logo */}
          <div className="flex justify-center mb-4">
            <img 
              src={zLogo} 
              alt="Z Logo" 
              className="h-16 w-16 object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>
          
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              {showSecondaryAuth ? "Admin Verification" : "ZED AI System"}
            </CardTitle>
            <CardDescription className="text-gray-400 mt-2">
              {showSecondaryAuth ? "Enhanced Security Required" : "Diagnostic Solution-Based AI Agent"}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-black/50 border-purple-500/50 text-white placeholder:text-gray-400 focus:border-purple-400 focus:ring-purple-400/20"
                required
                disabled={showSecondaryAuth}
              />
            </div>
            
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/50 border-purple-500/50 text-white placeholder:text-gray-400 focus:border-purple-400 focus:ring-purple-400/20"
                required
                disabled={showSecondaryAuth}
              />
            </div>

            {showSecondaryAuth && (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Secure Phrase (XOCLON_SECURE_2025)"
                  value={securePhrase}
                  onChange={(e) => setSecurePhrase(e.target.value)}
                  className="bg-black/50 border-yellow-500/50 text-white placeholder:text-gray-400 focus:border-yellow-400 focus:ring-yellow-400/20"
                  required
                />
                <p className="text-xs text-gray-500">
                  Admin login from new device requires secure phrase verification
                </p>
              </div>
            )}

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded p-2">
                {error}
              </div>
            )}

            <Button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-2 px-4 rounded-md transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
            >
              {isLoading ? "Signing In..." : showSecondaryAuth ? "Verify & Sign In" : "Sign In"}
            </Button>

            {showSecondaryAuth && (
              <Button 
                type="button"
                onClick={() => {setShowSecondaryAuth(false); setSecurePhrase(""); setError("");}}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white"
              >
                Back to Login
              </Button>
            )}
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Enhanced Security Features:</p>
            <p>• Device fingerprinting • Session timeout (45 min)</p>
            <p>• Challenge recovery • Secure phrase override</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}