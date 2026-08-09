import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/queryClient";

type PermissionKey = "memory" | "knowledge" | "projects" | "reminders" | "commands";

interface SmsStatus {
  active: boolean;
  status: "active" | "disabled" | "revoked" | "not_connected";
  phoneLastFour: string | null;
  permissions: Record<PermissionKey, boolean>;
  recentSecurityActivity: Array<{ eventType: string; createdAt: string }>;
}

const LABELS: Record<PermissionKey, string> = {
  memory: "Memory",
  knowledge: "Knowledge",
  projects: "Projects",
  reminders: "Reminders",
  commands: "Commands",
};

export function NexysSmsSettings() {
  const [status, setStatus] = useState<SmsStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [message, setMessage] = useState("Loading...");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/sms/connection", { credentials: "include" });
      if (!response.ok) throw new Error("Unavailable");
      const next = await response.json() as SmsStatus;
      setStatus(next);
      setMessage(next.active ? "ZAR by Text is active" : next.status === "disabled" ? "Text access is paused" : "Connect a phone number");
    } catch {
      setMessage("ZAR by Text is unavailable");
    }
  }

  useEffect(() => { void load(); }, []);

  async function requestCode() {
    setBusy(true);
    try {
      const response = await apiRequest("POST", "/api/sms/connection/challenge", { phone, permissions: status?.permissions });
      const result = await response.json() as { challengeId: string; phoneLastFour: string };
      setChallengeId(result.challengeId);
      setMessage(`Code sent to ••••${result.phoneLastFour}`);
    } catch {
      setMessage("The verification code could not be sent");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!challengeId) return;
    setBusy(true);
    try {
      await apiRequest("POST", "/api/sms/connection/verify", { challengeId, code });
      setCode("");
      setChallengeId(null);
      await load();
    } catch {
      setMessage("Verification could not be completed");
    } finally {
      setBusy(false);
    }
  }

  async function togglePermission(key: PermissionKey) {
    if (!status) return;
    const permissions = { ...status.permissions, [key]: !status.permissions[key] };
    setStatus({ ...status, permissions });
    try {
      await apiRequest("PUT", "/api/sms/connection/permissions", { permissions });
      setMessage("Text permissions updated");
    } catch {
      setStatus(status);
      setMessage("Permissions could not be updated");
    }
  }

  async function revoke() {
    if (!window.confirm("Disconnect this number from ZAR by Text?")) return;
    setBusy(true);
    try {
      await apiRequest("DELETE", "/api/sms/connection");
      await load();
    } catch {
      setMessage("The number could not be disconnected");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-h-[260px] overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[12px] text-white/70">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-cyan-50">ZAR by Text</p>
          <p className="text-white/45">{message}</p>
        </div>
        {status?.phoneLastFour && <span className="rounded-full border border-white/10 px-2 py-1">••••{status.phoneLastFour}</span>}
      </div>

      {!status?.active && status?.status !== "disabled" && (
        <div className="space-y-2">
          {!challengeId ? (
            <div className="flex gap-2">
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile number" inputMode="tel" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-cyan-200/40" />
              <button type="button" disabled={busy || !phone.trim()} onClick={requestCode} className="rounded-lg border border-cyan-200/25 px-3 py-2 text-cyan-100 disabled:opacity-40">Send code</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" inputMode="numeric" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-cyan-200/40" />
              <button type="button" disabled={busy || code.length !== 6} onClick={verifyCode} className="rounded-lg border border-cyan-200/25 px-3 py-2 text-cyan-100 disabled:opacity-40">Verify</button>
            </div>
          )}
          <p className="text-[10px] leading-relaxed text-white/40">By verifying, you approve SMS access under the permissions shown after connection. Carrier message rates may apply.</p>
        </div>
      )}

      {(status?.active || status?.status === "disabled") && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(LABELS) as PermissionKey[]).map((key) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1.5">
                <input type="checkbox" checked={status.permissions[key]} onChange={() => void togglePermission(key)} />
                {LABELS[key]}
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[10px] text-white/40">Text STOP anytime to pause messages.</span>
            <button type="button" disabled={busy} onClick={revoke} className="rounded-lg border border-red-300/20 px-3 py-1.5 text-red-200 disabled:opacity-40">Disconnect</button>
          </div>
        </>
      )}
    </div>
  );
}
