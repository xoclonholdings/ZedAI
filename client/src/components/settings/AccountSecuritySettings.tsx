import { LogOut, Shield, User } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/UseAuth";

type SettingsUser = {
  username?: string;
  displayName?: string;
  email?: string;
  isAdmin?: boolean;
  claims?: { isAdmin?: boolean };
};

export default function AccountSecuritySettings() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth() as { user?: SettingsUser | null; logout: () => Promise<void> };
  const isAdmin = !!user?.isAdmin || !!user?.claims?.isAdmin || user?.email === "admin@zed-ai.online";

  async function handleLogout() {
    await logout();
    queryClient.clear();
    navigate("/login");
  }

  return (
    <Card className="zed-glass border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-400" />
          Account Security
        </CardTitle>
        <CardDescription>
          Review the current session and account access state.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <User className="h-4 w-4 text-cyan-300" />
            Current Account
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>Name</span>
              <span className="truncate text-white">{user?.displayName || user?.username || "Current user"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Email</span>
              <span className="truncate text-white">{user?.email || "Not provided"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Access</span>
              <Badge className={isAdmin ? "border-green-400/30 bg-green-500/10 text-green-300" : "border-white/10 bg-white/[0.04] text-muted-foreground"}>
                {isAdmin ? "Admin" : "User"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-muted-foreground">
          Password and secure-phrase controls are managed by the configured authentication layer. Admin-only session policy controls appear below for admin users.
        </div>

        <Button variant="outline" onClick={handleLogout} className="w-full justify-center border-white/10">
          <LogOut className="mr-2 h-4 w-4" />
          Logout on This Device
        </Button>
      </CardContent>
    </Card>
  );
}
