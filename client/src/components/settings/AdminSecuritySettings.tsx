import { useEffect, useState } from "react";
import { Save, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SecuritySettingsState = {
  adminUsername: string;
  securePhraseConfigured: boolean;
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  requireSecureCookies: boolean;
  effectiveSecureCookies: boolean;
};

const defaults: SecuritySettingsState = {
  adminUsername: "Admin",
  securePhraseConfigured: false,
  sessionTimeoutMinutes: 45,
  maxFailedAttempts: 10,
  lockoutDurationMinutes: 1,
  requireSecureCookies: false,
  effectiveSecureCookies: false,
};

export default function AdminSecuritySettings() {
  const [securitySettings, setSecuritySettings] = useState<SecuritySettingsState>(defaults);
  const [draft, setDraft] = useState({
    adminUsername: "",
    newSecurePhrase: "",
    sessionTimeoutMinutes: 45,
    maxFailedAttempts: 10,
    lockoutDurationMinutes: 1,
    requireSecureCookies: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  async function fetchSecuritySettings() {
    try {
      const response = await fetch("/api/admin/security-settings", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSecuritySettings({ ...defaults, ...data });
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
              <p>Secure cookies: {securitySettings.effectiveSecureCookies ? "enabled" : "disabled"}</p>
              <p>Secure phrase: {securitySettings.securePhraseConfigured ? "configured" : "missing"}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Secure Phrase Status</Label>
            <Input
              value={securitySettings.securePhraseConfigured ? "Configured" : "Not configured"}
              readOnly
              className="zed-glass border-white/10 bg-black/20"
            />
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
                  setDraft((prev) => ({ ...prev, maxFailedAttempts: Number(e.target.value) || 10 }))
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
                  setDraft((prev) => ({ ...prev, lockoutDurationMinutes: Number(e.target.value) || 1 }))
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
