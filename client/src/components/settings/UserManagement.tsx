import { useEffect, useState } from "react";
import { Plus, Shield, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ManagedUser = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  isActive: boolean;
};

const emptyForm = {
  username: "",
  password: "",
  email: "",
  firstName: "",
  lastName: "",
};

export default function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    try {
      const response = await fetch("/api/admin/users", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch {
      // ignore load failures in UI
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createUser() {
    if (!form.username.trim() || !form.password.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setForm(emptyForm);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create user");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(user: ManagedUser) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isActive: !user.isActive }),
    });

    if (response.ok) {
      const data = await response.json();
      setUsers(data.users || []);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="h-6 w-6 text-purple-400" />
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          User Management
        </h2>
      </div>

      <Card className="bg-black/60 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-cyan-400" />
            Add User
          </CardTitle>
          <CardDescription>
            Single-admin mode stays intact while the admin can provision additional local users.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>First Name</Label>
            <Input value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Last Name</Label>
            <Input value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Button
              onClick={createUser}
              disabled={saving || !form.username.trim() || !form.password.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              {saving ? "Creating..." : "Create User"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-black/60 border-purple-500/20">
        <CardHeader>
          <CardTitle>Managed Users</CardTitle>
          <CardDescription>Admin remains the only admin account. Added users are workspace users only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{user.username}</p>
                  <Badge className={user.isAdmin ? "bg-purple-500/20 text-purple-200" : "bg-cyan-500/20 text-cyan-200"}>
                    {user.isAdmin ? "Admin" : "User"}
                  </Badge>
                  <Badge className={user.isActive ? "bg-green-500/20 text-green-200" : "bg-red-500/20 text-red-200"}>
                    {user.isActive ? "Active" : "Disabled"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {user.firstName} {user.lastName} • {user.email}
                </p>
              </div>

              {!user.isAdmin && (
                <Button variant="outline" className="border-white/10" onClick={() => toggleUser(user)}>
                  {user.isActive ? "Disable User" : "Re-enable User"}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
