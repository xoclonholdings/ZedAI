import { useEffect, useState } from "react";
import { Eye, EyeOff, Save, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminSecuritySettings() {
  const [securitySettings, setSecuritySettings] = useState({
    currentSecurePhrase: "",
    sessionTimeoutMinutes: 45,
    maxFailedAttempts: 3,
    lockoutDurationMinutes: 15,
  });
  const [newSecurePhrase, setNewSecurePhrase] = useState("");
  const [showCurrentPhrase, setShowCurrentPhrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchSecuritySettings() {
    try {
      const response = await fetch("/api/admin/security-settings");

      if (response.ok) {
        const data = await response.json();
        setSecuritySettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch security settings:", error);
    }
  }

  async function updateSecuritySettings() {
    if (!newSecurePhrase.trim()) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/security-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSecurePhrase: newSecurePhrase.trim() }),
      });

      if (response.ok) {
        await fetchSecuritySettings();
        setNewSecurePhrase("");
        alert("Secure phrase updated successfully!");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update secure phrase");
      }
    } catch (error) {
      alert("Failed to update secure phrase");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchSecuritySettings();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Security Settings
          </CardTitle>
          <CardDescription>
            Manage advanced security settings for the ZED system
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Current Security Status</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Session timeout: {securitySettings.sessionTimeoutMinutes} minutes</p>
              <p>• Max failed attempts: {securitySettings.maxFailedAttempts}</p>
              <p>• Lockout duration: {securitySettings.lockoutDurationMinutes} minutes</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Current Secure Phrase</Label>
            <div className="flex items-center space-x-2">
              <Input
                type={showCurrentPhrase ? "text" : "password"}
                value={securitySettings.currentSecurePhrase}
                readOnly
                className="zed-glass border-white/10 bg-black/20"
              />

              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowCurrentPhrase((prev) => !prev)}
                className="zed-glass border-white/10"
              >
                {showCurrentPhrase ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Update Secure Phrase</Label>
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Enter new secure phrase (min 8 characters)"
                value={newSecurePhrase}
                onChange={(e) => setNewSecurePhrase(e.target.value)}
                className="zed-glass border-white/10"
              />

              <Button
                onClick={updateSecuritySettings}
                disabled={isLoading || newSecurePhrase.length < 8}
                className="w-full zed-glass bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Secure Phrase
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              The secure phrase is used for admin verification and bypass authentication.
              It must be at least 8 characters long and should be kept confidential.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}