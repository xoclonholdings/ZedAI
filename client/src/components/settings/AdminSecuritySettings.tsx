import { useEffect, useState } from "react";
import { Eye, EyeOff, Save, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SecuritySettingsState = {
  adminUsername: string;
  currentSecurePhrase: string;
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  requireSecureCookies: boolean;
};

const defaults: SecuritySettingsState = {
  adminUsername: "Admin",
  currentSecurePhrase: "",
  sessionTimeoutMinutes: 45,
  maxFailedAttempts: 3,
  lockoutDurationMinutes: 15,
  requireSecureCookies: false,
};

export default function AdminSecuritySettings() {
  const [securitySettings, setSecuritySettings] = useState<SecuritySettingsState>(defaults);
  const [draft, setDraft] = useState({
    adminUsername: "",
    newSecurePhrase: "",
    sessionTimeoutMinutes: 45,
    maxFailedAttempts: 3,
    lockoutDurationMinutes: 15,
    requireSecureCookies: false,
  });
  const [showCurrentPhrase, setShowCurrentPhrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchSecuritySettings() {
    try {
      const response = await fetch("/api/admin/security-settings", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSecuritySettings(data);
        setDraft({
          adminUsername: data.adminUsername || "Admin",
          newSecurePhrase: "",
          sessionTimeoutMinutes: data.sessionTimeoutMinutes,
          maxFailedAttempts: data.maxFailedAttempts,
          lockoutDurationMinutes: data.lockoutDurationMinutes,
          requireSecureCookies: data.requireSecureCookies,
        });
      }
    } catch (error) {
      console.error("Failed to fetch security settings:", error);
    }
  }

  async function updateSecuritySettings() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/security-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          adminUsername: draft.adminUsername,
          newSecurePhrase: draft.newSecurePhrase || undefined,
          sessionTimeoutMinutes: Number(draft.sessionTimeoutMinutes),
          maxFailedAttempts: Number(draft.maxFailedAttempts),
          lockoutDurationMinutes: Number(draft.lockoutDurationMinutes),
          requireSecureCookies: draft.requireSecureCookies,
        }),
      });

      if (response.ok) {
        await fetchSecuritySettings();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update security settings");
      }
    } catch (error) {
      console.error("Failed to update security settings:", error);
      alert("Failed to update security settings");
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
            Manage admin access, session controls, and secure recovery settings.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Admin Username</Label>
            <Input
              value={draft.adminUsername}
              onChange={(e) => setDraft((prev) => ({ ...prev, adminUsername: e.target.value }))}
              className="zed-glass border-white/10"
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Current Security Status</h4>
            <div className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
              <p>Session timeout: {securitySettings.sessionTimeoutMinutes} minutes</p>
              <p>Max failed attempts: {securitySettings.maxFailedAttempts}</p>
              <p>Lockout duration: {securitySettings.lockoutDurationMinutes} minutes</p>
              <p>Secure cookies: {securitySettings.requireSecureCookies ? "enabled" : "disabled"}</p>
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
                {showCurrentPhrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Session Timeout (minutes)</Label>
              <Input
                type="number"
                min={5}
                max={480}
                value={draft.sessionTimeoutMinutes}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, sessionTimeoutMinutes: Number(e.target.value) || 45 }))
                }
                className="zed-glass border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Max Failed Attempts</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={draft.maxFailedAttempts}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, maxFailedAttempts: Number(e.target.value) || 3 }))
                }
                className="zed-glass border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Lockout Duration (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={draft.lockoutDurationMinutes}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, lockoutDurationMinutes: Number(e.target.value) || 15 }))
                }
                className="zed-glass border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Secure Cookies</Label>
              <Button
                variant="outline"
                onClick={() =>
                  setDraft((prev) => ({ ...prev, requireSecureCookies: !prev.requireSecureCookies }))
                }
                className="w-full zed-glass border-white/10 justify-start"
              >
                {draft.requireSecureCookies ? "Enabled" : "Disabled"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Update Secure Phrase</Label>
            <Input
              type="text"
              placeholder="Enter new secure phrase (min 8 characters)"
              value={draft.newSecurePhrase}
              onChange={(e) => setDraft((prev) => ({ ...prev, newSecurePhrase: e.target.value }))}
              className="zed-glass border-white/10"
            />
          </div>

          <Button
            onClick={updateSecuritySettings}
            disabled={isLoading}
            className="w-full zed-glass bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? "Updating..." : "Save Security Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
