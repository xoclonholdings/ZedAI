import { useEffect, useState } from "react";
import { Lock, RefreshCw, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AdminSecuritySettings from "@/components/settings/AdminSecuritySettings";
import EnvValidatorCard from "@/components/admin/EnvValidatorCard";

interface ManagedUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  isActive?: boolean;
}

const emptyUserForm = {
  username: "",
  password: "",
  email: "",
  firstName: "",
  lastName: "",
};

export default function SecuritySection() {
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userNotice, setUserNotice] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  async function fetchSecurityLog() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/security-log", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEvents((data.events || []).reverse());
      }
    } catch {}
    setLoading(false);
  }

  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {}
    setUsersLoading(false);
  }

  useEffect(() => {
    void fetchSecurityLog();
    void fetchUsers();
  }, []);

  function updateUserForm(field: keyof typeof emptyUserForm, value: string) {
    setUserForm((current) => ({ ...current, [field]: value }));
    setUserNotice(null);
    setUserError(null);
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUserNotice(null);
    setUserError(null);

    const username = userForm.username.trim();
    const password = userForm.password;

    if (!username) {
      setUserError("Username is required.");
      return;
    }

    if (!password) {
      setUserError("Password is required.");
      return;
    }

    if (password.length < 8) {
      setUserError("Password must be at least 8 characters long.");
      return;
    }

    setIsCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
          email: userForm.email.trim() || undefined,
          firstName: userForm.firstName.trim() || undefined,
          lastName: userForm.lastName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create user");
      }

      setUsers(data.users || []);
      setUserForm(emptyUserForm);
      setUserNotice("User created.");
      await fetchSecurityLog();
    } catch (err: any) {
      setUserError(err?.message || "Failed to create user");
    } finally {
      setIsCreatingUser(false);
    }
  }

  return (
    <>
      <AdminSecuritySettings />
      <EnvValidatorCard />

      <Card className="zed-glass border-white/10">
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-2 text-cyan-300">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Add Test User</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create a non-admin login account for testing normal ZED access.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Username</span>
                <input
                  value={userForm.username}
                  onChange={(e) => updateUserForm("username", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-cyan-400/50"
                  placeholder="testuser"
                  autoComplete="off"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Password</span>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => updateUserForm("password", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-cyan-400/50"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Email optional</span>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => updateUserForm("email", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-cyan-400/50"
                  placeholder="test@zed-ai.local"
                  autoComplete="off"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">First name</span>
                  <input
                    value={userForm.firstName}
                    onChange={(e) => updateUserForm("firstName", e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-cyan-400/50"
                    placeholder="Test"
                    autoComplete="off"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Last name</span>
                  <input
                    value={userForm.lastName}
                    onChange={(e) => updateUserForm("lastName", e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-cyan-400/50"
                    placeholder="User"
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>

            {userNotice && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">
                {userNotice}
              </div>
            )}
            {userError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {userError}
              </div>
            )}

            <Button
              type="submit"
              disabled={isCreatingUser}
              className="rounded-xl zed-gradient"
            >
              <UserPlus size={14} className="mr-1" />
              {isCreatingUser ? "Adding…" : "Add User"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-white/10 bg-black/30 p-2 text-purple-300">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Managed Users</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Existing local users available for login testing.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchUsers}
              disabled={usersLoading}
              className="zed-button text-muted-foreground hover:text-foreground"
            >
              <RefreshCw size={14} className={`mr-1 ${usersLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {usersLoading ? (
            <div className="text-center text-muted-foreground py-6">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-muted-foreground">
              No managed users found.
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-white">{user.username}</span>
                  <span className="text-muted-foreground">{user.email || "No email"}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] ${
                    user.isActive === false
                      ? "border-red-500/30 text-red-300"
                      : "border-green-500/30 text-green-300"
                  }`}>
                    {user.isActive === false ? "Inactive" : "Active"}
                  </span>
                  <span className="rounded-full border border-purple-500/30 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-purple-300">
                    {user.isAdmin ? "Admin" : "User"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-4">
        <div>
          <h2 className="text-lg font-semibold">Security Event Log</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auth events, tier blocks, approvals, and audit trail.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchSecurityLog}
          className="zed-button text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : events.length === 0 ? (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <Lock size={32} className="mx-auto mb-3 text-purple-400/50" />
            No security events recorded yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="zed-glass border-white/10">
          <CardContent className="pt-4">
            <div className="space-y-1 max-h-[60vh] overflow-y-auto font-mono">
              {events.map((evt, i) => {
                const isWarn =
                  evt.type?.includes("fail") ||
                  evt.type?.includes("block") ||
                  evt.type?.includes("reject");
                const isOk =
                  evt.type?.includes("success") || evt.type?.includes("approved");
                return (
                  <div
                    key={i}
                    className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5 flex items-start gap-2"
                  >
                    <span className="text-muted-foreground shrink-0 w-[70px]">
                      {evt.timestamp
                        ? new Date(evt.timestamp).toLocaleTimeString()
                        : ""}
                    </span>
                    <span
                      className={`font-medium shrink-0 w-[160px] truncate ${
                        isWarn ? "text-red-400" : isOk ? "text-green-400" : "text-purple-400"
                      }`}
                    >
                      {evt.type || "unknown"}
                    </span>
                    <span className="text-foreground/70 truncate">{evt.detail || ""}</span>
                    {evt.userId && (
                      <span className="text-muted-foreground/50 shrink-0 ml-auto">
                        {evt.userId}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
